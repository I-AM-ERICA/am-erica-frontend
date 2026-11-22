import { readRoute } from './navigation'
import { apiFetch } from './api'
import type { AppPage } from '../types'

export interface AuthUser { id: number; name: string; email: string }
interface Session { accessToken: string; expiresAt: number }
interface LoginAttempt { state: string; createdAt: number; redirectUri: string; returnTo: AppPage }
export interface AuthResult { user: AuthUser | null; returnTo?: AppPage; error?: string }

const SESSION_KEY = 'gage-auth-session'
const ATTEMPT_KEY = 'gage-naver-attempt'
const REGISTRATION_KEY = 'gage-naver-registration'
const ATTEMPT_TTL = 10 * 60 * 1000
export const AUTH_CHANGED = 'gage-auth-changed'
let session: Session | null = null
let initialization: Promise<AuthResult> | undefined

function readStored(key: string): unknown {
  try { return JSON.parse(sessionStorage.getItem(key) ?? 'null') } catch { return null }
}
function removeStored(key: string) {
  try { sessionStorage.removeItem(key) } catch { /* In-memory logout still works. */ }
}
function readSession(): Session | null {
  const value = readStored(SESSION_KEY) as Partial<Session> | null
  return value && typeof value.accessToken === 'string' && value.accessToken.length > 0 && typeof value.expiresAt === 'number' && value.expiresAt > Date.now()
    ? value as Session : null
}
export function logout() {
  session = null
  removeStored(SESSION_KEY)
  removeStored(ATTEMPT_KEY)
  clearNaverRegistration()
  window.dispatchEvent(new Event(AUTH_CHANGED))
}
export function getAuthHeaders(): Record<string, string> {
  if (!session || session.expiresAt <= Date.now()) return {}
  return { Authorization: `Bearer ${session.accessToken}` }
}
export function getSessionExpiresAt(): number | null { return session?.expiresAt ?? null }

async function authRequest(path: string, init: RequestInit = {}) {
  const response = await apiFetch(path, { ...init, signal: AbortSignal.timeout(15000), cache: 'no-store' })
  if (!response.ok) {
    if (response.status === 401) logout()
    const problem = await response.json().catch(() => null) as { code?: string } | null
    const messages: Record<string, string> = {
      INVALID_VERIFICATION: '인증번호가 틀렸거나 만료되었어요. 5회 실패했다면 새 번호를 받아 주세요.',
      VERIFICATION_RATE_LIMITED: '인증번호 요청이 많아요. 1분 이상 기다려 주세요. 한 시간에 최대 5회 받을 수 있어요.',
      SIGNUP_MAIL_UNAVAILABLE: '인증 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
      VALIDATION_FAILED: '로그인 요청과 인증번호를 확인해 주세요.',
      NAVER_EMAIL_REQUIRED: '처음 가입할 때는 네이버 이메일 제공 동의가 필요해요. 네이버 계정의 이메일 정보를 확인한 후 다시 로그인해 주세요.',
      NAVER_REGISTRATION_EXPIRED: '가입 인증 요청이 만료되었어요. 네이버로 다시 로그인해 주세요.',
      NAVER_LOGIN_REQUIRED: '네이버로 로그인해 주세요.',
      NAVER_NOT_CONFIGURED: '네이버 로그인 연결을 준비 중이에요. 잠시 후 다시 이용해 주세요.',
      NAVER_INVALID_REDIRECT: '로그인 콜백 주소 설정을 확인해 주세요.',
      NAVER_AUTH_FAILED: '네이버 인증이 만료되었거나 거부되었어요. 다시 로그인해 주세요.',
      NAVER_EMAIL_CONFLICT: '같은 이메일로 가입된 계정이 있어요. 계정 연결은 별도 확인이 필요해요.',
      NAVER_INVALID_PROFILE: '네이버 회원 정보를 확인하지 못했어요. 다시 시도해 주세요.',
    }
    if (problem?.code === 'NAVER_REGISTRATION_EXPIRED') clearNaverRegistration()
    throw new Error((problem?.code && messages[problem.code]) || (response.status === 401
      ? '로그인이 만료되었어요. 다시 로그인해 주세요.'
      : '로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'))
  }
  return response.json() as Promise<unknown>
}
async function loadUser(): Promise<AuthUser> {
  const data = await authRequest('/api/users/me', { headers: getAuthHeaders() }) as Partial<AuthUser> | null
  if (!data || typeof data.id !== 'number' || typeof data.name !== 'string' || typeof data.email !== 'string') throw new Error('로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.')
  return data as AuthUser
}

export function startNaverLogin(returnTo: AppPage = 'setup') {
  const clientId = import.meta.env.VITE_NAVER_CLIENT_ID?.trim()
  if (!clientId) throw new Error('네이버 로그인 연결을 준비 중이에요. 잠시 후 다시 이용해 주세요.')
  const defaultCallback = import.meta.env.PROD ? import.meta.env.BASE_URL : '/api/auth/callback/naver'
  const redirectUri = import.meta.env.VITE_NAVER_REDIRECT_URI?.trim() || new URL(defaultCallback, window.location.origin).href
  const redirect = new URL(redirectUri)
  if (redirect.origin !== window.location.origin || redirect.hash || redirect.search) throw new Error('로그인 연결 설정을 확인해 주세요.')
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const attempt: LoginAttempt = { state, createdAt: Date.now(), redirectUri, returnTo: returnTo === 'login' || returnTo === 'intro' ? 'setup' : returnTo }
  try { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt)) } catch { throw new Error('로그인하려면 브라우저의 사이트 저장 공간을 허용해 주세요.') }
  clearNaverRegistration()
  const url = new URL('https://nid.naver.com/oauth2.0/authorize')
  url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state }).toString()
  window.location.assign(url.toString())
}

export function hasNaverCallback(): boolean {
  const query = new URLSearchParams(window.location.search)
  return window.location.pathname === '/api/auth/callback/naver' || query.has('code') || query.has('state') || query.has('error')
}

async function completeNaverLogin(): Promise<AuthResult> {
  const query = new URLSearchParams(window.location.search)
  const attempt = readStored(ATTEMPT_KEY) as Partial<LoginAttempt> | null
  // Remove sensitive OAuth parameters before rendering or sending another request.
  const cleanUrl = new URL(window.location.href)
  if (cleanUrl.pathname === '/api/auth/callback/naver') cleanUrl.pathname = '/'
  for (const key of ['code', 'state', 'error', 'error_description']) cleanUrl.searchParams.delete(key)
  cleanUrl.hash = 'login'
  window.history.replaceState(null, '', cleanUrl)
  removeStored(ATTEMPT_KEY)
  if (!attempt || typeof attempt.state !== 'string' || !attempt.state || attempt.state !== query.get('state') || typeof attempt.createdAt !== 'number' || Date.now() - attempt.createdAt > ATTEMPT_TTL || attempt.createdAt > Date.now() || typeof attempt.redirectUri !== 'string') {
    throw new Error('로그인 요청이 만료되었거나 올바르지 않아요. 다시 로그인해 주세요.')
  }
  if (query.has('error')) throw new Error('네이버 로그인이 취소되었어요. 다시 시도해 주세요.')
  const code = query.get('code')
  if (!code) throw new Error('네이버 인증 정보를 받지 못했어요. 다시 로그인해 주세요.')
  const data = await authRequest('/api/auth/naver', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state: attempt.state, redirectUri: attempt.redirectUri }),
  }) as (TokenPayload & { verificationRequired?: boolean; registrationToken?: unknown; email?: unknown }) | null
  if (data?.verificationRequired === true) {
    if (typeof data.registrationToken !== 'string' || !/^[a-f0-9]{64}$/.test(data.registrationToken)
        || typeof data.email !== 'string' || !data.email.includes('@')
        || typeof data.expiresIn !== 'number' || !Number.isFinite(data.expiresIn) || data.expiresIn <= 0 || data.expiresIn > 3600) {
      throw new Error('가입 인증 정보를 확인하지 못했어요. 네이버로 다시 로그인해 주세요.')
    }
    session = null
    removeStored(SESSION_KEY)
    saveRegistration({ registrationToken: data.registrationToken, email: data.email,
      expiresAt: Date.now() + data.expiresIn * 1000, returnTo: readRoute(`#${attempt.returnTo}`) })
    return { user: null, returnTo: 'login' }
  }
  clearNaverRegistration()
  const user = await acceptToken(data)
  return { user, returnTo: readRoute(`#${attempt.returnTo}`) }
}

// A single promise prevents React StrictMode from exchanging the same one-use code twice.
export function initializeAuth(): Promise<AuthResult> {
  if (!initialization) initialization = (async () => {
    try {
      if (hasNaverCallback()) return await completeNaverLogin()
      session = readSession()
      if (!session) { removeStored(SESSION_KEY); return { user: null } }
      return { user: await loadUser() }
    } catch (error) {
      logout()
      return { user: null, error: error instanceof Error && error.name !== 'TypeError' && error.name !== 'TimeoutError' ? error.message : '로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' }
    }
  })()
  return initialization
}

interface TokenPayload { accessToken?: unknown; tokenType?: unknown; expiresIn?: unknown }
async function acceptToken(data: TokenPayload | null): Promise<AuthUser> {
  if (!data || typeof data.accessToken !== 'string' || !data.accessToken || data.tokenType !== 'Bearer' || typeof data.expiresIn !== 'number' || !Number.isFinite(data.expiresIn) || data.expiresIn <= 0 || data.expiresIn > 31536000) throw new Error('로그인 서버 응답을 확인하지 못했어요. 다시 시도해 주세요.')
  session = { accessToken: data.accessToken, expiresAt: Date.now() + data.expiresIn * 1000 }
  const user = await loadUser()
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch { /* Current visit remains authenticated. */ }
  return user
}

export interface NaverRegistration {
  registrationToken: string
  email: string
  expiresAt: number
  returnTo: AppPage
  challenge?: { id: string; expiresAt: number; resendAt: number }
}
export function clearNaverRegistration() { removeStored(REGISTRATION_KEY) }
function saveRegistration(value: NaverRegistration) {
  try { sessionStorage.setItem(REGISTRATION_KEY, JSON.stringify(value)) }
  catch { throw new Error('인증을 진행하려면 브라우저의 사이트 저장 공간을 허용해 주세요.') }
}
export function getNaverRegistration(): NaverRegistration | null {
  const value = readStored(REGISTRATION_KEY) as Partial<NaverRegistration> | null
  if (!value || typeof value.registrationToken !== 'string' || !/^[a-f0-9]{64}$/.test(value.registrationToken)
      || typeof value.email !== 'string' || typeof value.expiresAt !== 'number' || value.expiresAt <= Date.now()) {
    clearNaverRegistration(); return null
  }
  const challenge = value.challenge
  if (challenge && (typeof challenge.id !== 'string' || !/^[a-f0-9]{64}$/.test(challenge.id)
      || !Number.isFinite(challenge.expiresAt) || !Number.isFinite(challenge.resendAt))) delete value.challenge
  return { ...value, returnTo: readRoute(`#${value.returnTo}`) } as NaverRegistration
}
function requireRegistration(): NaverRegistration {
  const value = getNaverRegistration()
  if (!value) throw new Error('가입 인증 요청이 만료되었어요. 네이버로 다시 로그인해 주세요.')
  return value
}
export async function requestNaverSignupCode(): Promise<NaverRegistration> {
  const registration = requireRegistration()
  const data = await authRequest('/api/auth/naver/email-code', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registrationToken: registration.registrationToken }),
  }) as { verificationId?: unknown; expiresIn?: unknown; resendAfter?: unknown } | null
  if (!data || typeof data.verificationId !== 'string' || !/^[a-f0-9]{64}$/.test(data.verificationId)
      || typeof data.expiresIn !== 'number' || !Number.isFinite(data.expiresIn) || data.expiresIn <= 0 || data.expiresIn > 3600
      || typeof data.resendAfter !== 'number' || !Number.isFinite(data.resendAfter) || data.resendAfter < 0 || data.resendAfter > 3600) {
    throw new Error('인증 메일 요청 결과를 확인하지 못했어요. 다시 요청해 주세요.')
  }
  const now = Date.now()
  const updated = { ...registration, challenge: { id: data.verificationId,
    expiresAt: Math.min(registration.expiresAt, now + data.expiresIn * 1000), resendAt: now + data.resendAfter * 1000 } }
  saveRegistration(updated)
  return updated
}
export async function verifyNaverSignup(code: string): Promise<{ user: AuthUser; returnTo: AppPage }> {
  const registration = requireRegistration()
  if (!registration.challenge || registration.challenge.expiresAt <= Date.now()) throw new Error('인증번호를 다시 받아 주세요.')
  try {
    const data = await authRequest('/api/auth/naver/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationToken: registration.registrationToken, verificationId: registration.challenge.id, code }),
    }) as TokenPayload | null
    const user = await acceptToken(data)
    clearNaverRegistration()
    return { user, returnTo: registration.returnTo }
  } catch (error) {
    session = null
    removeStored(SESSION_KEY)
    if (error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError')) {
      throw new Error('서버 응답을 확인하지 못했어요. 인증을 제출한 뒤라면 네이버로 다시 로그인해 주세요.')
    }
    throw error
  }
}
