import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer, loadConfigFromFile } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
after(() => server.close())
const { readRoute, resolveRoute } = await server.ssrLoadModule('/src/services/navigation.ts')

test('every protected route requires login, including previously onboarded browsers', () => {
  assert.equal(readRoute('#login'), 'login')
  for (const hasStore of [true, false]) {
    assert.equal(resolveRoute('intro', hasStore, false), 'intro')
    for (const route of ['setup', 'dashboard', 'policy', 'marketing', 'customer', 'sales', 'history', 'settings']) assert.equal(resolveRoute(route, hasStore, false), 'login')
  }
  assert.equal(resolveRoute('login', true, true), 'dashboard')
  assert.equal(resolveRoute('login', false, true), 'setup')
  assert.equal(resolveRoute('policy', true, true), 'policy')
})

test('landing exposes login and Login renders errors and a disabled checking state', async () => {
  const { default: Login } = await server.ssrLoadModule('/src/pages/Login.tsx')
  const { default: LandingPage } = await server.ssrLoadModule('/src/pages/LandingPage.tsx')
  const noop = () => {}
  assert.match(renderToStaticMarkup(createElement(LandingPage, { hasStore: false, onStart: noop, onResume: noop, onLogin: noop, onLogout: noop })), />로그인<\/button>/)
  const login = renderToStaticMarkup(createElement(Login, { onBack: noop, returnTo: 'setup', checking: true, error: '인증 실패' }))
  assert.match(login, /disabled=""/)
  assert.match(login, /role="alert">인증 실패/)
})

let scenario = 0
async function withAuth(t, { query = '', pathname = '/', attempt, session, registration, response } = {}, run) {
  const storage = new Map()
  if (attempt) storage.set('gage-naver-attempt', JSON.stringify(attempt))
  if (session) storage.set('gage-auth-session', JSON.stringify(session))
  if (registration) storage.set('gage-naver-registration', JSON.stringify(registration))
  const calls = []
  let cleanedUrl
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls.push({ path, options })
    return response ? response(path, options) : new Response(JSON.stringify({ id: 1, email: 'owner@example.com', name: '사장' }), { status: 200 })
  })
  const originalWindow = globalThis.window
  const originalStorage = globalThis.sessionStorage
  globalThis.window = { location: { search: query, href: `http://localhost:7001${pathname}${query}`, origin: 'http://localhost:7001', pathname }, history: { replaceState: (_state, _title, url) => { cleanedUrl = String(url) } }, dispatchEvent() {} }
  globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) }
  try {
    const auth = await server.ssrLoadModule(`/src/services/auth.ts?scenario=${scenario++}`)
    await run({ auth, calls, storage, cleaned: () => cleanedUrl })
  } finally {
    globalThis.window = originalWindow
    globalThis.sessionStorage = originalStorage
    t.mock.restoreAll()
  }
}
const validAttempt = () => ({ state: 'random-state', createdAt: Date.now(), redirectUri: 'http://localhost:7001/api/auth/callback/naver', returnTo: 'policy' })

test('missing login session stays signed out without calling the server', async (t) => {
  await withAuth(t, {}, async ({ auth, calls }) => {
    assert.deepEqual(await auth.initializeAuth(), { user: null })
    assert.equal(calls.length, 0)
  })
})

test('mismatched or expired OAuth state cannot exchange a code', async (t) => {
  for (const attempt of [undefined, { ...validAttempt(), state: 'wrong' }, { ...validAttempt(), createdAt: Date.now() - 660000 }]) {
    await withAuth(t, { pathname: '/api/auth/callback/naver', query: '?code=secret-code&state=random-state', attempt }, async ({ auth, calls, cleaned }) => {
      const result = await auth.initializeAuth()
      assert.equal(result.user, null)
      assert.match(result.error, /올바르지/)
      assert.equal(calls.length, 0)
      assert.equal(cleaned(), 'http://localhost:7001/#login')
    })
  }
})

test('provider cancellation shows a retryable error and consumes the attempt', async (t) => {
  await withAuth(t, { pathname: '/api/auth/callback/naver', query: '?error=access_denied&state=random-state', attempt: validAttempt() }, async ({ auth, calls, storage }) => {
    assert.match((await auth.initializeAuth()).error, /취소/)
    assert.equal(calls.length, 0)
    assert.equal(storage.has('gage-naver-attempt'), false)
  })
})

test('successful callback exchanges once, verifies the user and restores the destination', async (t) => {
  await withAuth(t, { pathname: '/api/auth/callback/naver', query: '?code=secret-code&state=random-state', attempt: validAttempt(), response: (path) => new Response(JSON.stringify(path === '/api/auth/naver' ? { accessToken: 'service-token', tokenType: 'Bearer', expiresIn: 3600 } : { id: 1, name: '사장', email: 'owner@example.com' })) }, async ({ auth, calls, storage, cleaned }) => {
    const first = auth.initializeAuth()
    const second = auth.initializeAuth()
    assert.equal(first, second)
    const result = await first
    assert.equal(result.user.id, 1)
    assert.equal(result.returnTo, 'policy')
    assert.equal(cleaned(), 'http://localhost:7001/#login')
    assert.equal(JSON.parse(calls[0].options.body).redirectUri, 'http://localhost:7001/api/auth/callback/naver')
    assert.deepEqual(calls.map((call) => call.path), ['/api/auth/naver', '/api/users/me'])
    assert.equal(calls[1].options.headers.Authorization, 'Bearer service-token')
    assert.equal(storage.has('gage-naver-attempt'), false)
    assert.ok(storage.has('gage-auth-session'))
    auth.logout()
    assert.equal(storage.has('gage-auth-session'), false)
    assert.deepEqual(auth.getAuthHeaders(), {})
  })
})

test('a rejected or malformed session never authenticates', async (t) => {
  for (const response of [() => new Response('', { status: 401 }), () => new Response(JSON.stringify({ unexpected: true })), () => { throw new TypeError('Failed to fetch') }]) {
    await withAuth(t, { session: { accessToken: 'invalid-token', expiresAt: Date.now() + 60000 }, response }, async ({ auth, storage }) => {
      assert.equal((await auth.initializeAuth()).user, null)
      assert.equal(storage.has('gage-auth-session'), false)
      assert.deepEqual(auth.getAuthHeaders(), {})
    })
  }
})

test('expired sessions cannot restore login or send a token', async (t) => {
  await withAuth(t, { session: { accessToken: 'expired-token', expiresAt: Date.now() - 1 } }, async ({ auth, calls }) => {
    assert.equal((await auth.initializeAuth()).user, null)
    assert.equal(calls.length, 0)
    assert.deepEqual(auth.getAuthHeaders(), {})
  })
})


test('callback navigation loads the SPA while API calls retain the backend proxy', async () => {
  const { config } = await loadConfigFromFile({ command: 'serve', mode: 'development' })
  const proxy = config.server.proxy['/api']
  assert.equal(proxy.target, 'http://127.0.0.1:8000')
  assert.equal(proxy.bypass({ method: 'GET', url: '/api/auth/callback/naver?code=test&state=test' }), '/index.html')
  assert.equal(proxy.bypass({ method: 'GET', url: '/api/auth/callback/naver' }), '/index.html')
  for (const [method, url] of [['POST', '/api/auth/naver'], ['GET', '/api/users/me'], ['POST', '/api/auth/callback/naver'], ['GET', '/api/auth/callback/naver/other']]) {
    assert.equal(proxy.bypass({ method, url }), undefined)
  }
})

test('callback without OAuth parameters shows a recoverable error and returns to the app root', async (t) => {
  await withAuth(t, { pathname: '/api/auth/callback/naver' }, async ({ auth, calls, cleaned }) => {
    assert.equal(auth.hasNaverCallback(), true)
    const result = await auth.initializeAuth()
    assert.equal(result.user, null)
    assert.match(result.error, /다시 로그인/)
    assert.equal(calls.length, 0)
    assert.equal(cleaned(), 'http://localhost:7001/#login')
  })
})

test('backend configuration and account conflict errors remain actionable', async (t) => {
  for (const [status, code, message] of [[503, 'NAVER_NOT_CONFIGURED', /연결을 준비/], [409, 'NAVER_EMAIL_CONFLICT', /같은 이메일/], [400, 'NAVER_INVALID_REDIRECT', /콜백 주소/]]) {
    await withAuth(t, { pathname: '/api/auth/callback/naver', query: '?code=secret-code&state=random-state', attempt: validAttempt(), response: () => new Response(JSON.stringify({ code, detail: 'internal detail should not be shown' }), { status }) }, async ({ auth, storage }) => {
      const result = await auth.initializeAuth()
      assert.equal(result.user, null)
      assert.match(result.error, message)
      assert.doesNotMatch(result.error, /internal detail/)
      assert.equal(storage.has('gage-auth-session'), false)
    })
  }
})


const registration = () => ({ registrationToken: 'b'.repeat(64), email: 'naver@example.com', expiresAt: Date.now() + 1200000, returnTo: 'customer' })
const challenged = () => ({ ...registration(), challenge: { id: 'a'.repeat(64), expiresAt: Date.now() + 600000, resendAt: Date.now() + 60000 } })

test('new Naver callback enters verification without JWT or user lookup', async t => {
  await withAuth(t, { pathname: '/api/auth/callback/naver', query: '?code=one-use&state=random-state', attempt: validAttempt(), response: () => Response.json({ verificationRequired: true, registrationToken: 'b'.repeat(64), email: 'naver@example.com', expiresIn: 1200 }) }, async ({ auth, calls, storage }) => {
    assert.deepEqual(await auth.initializeAuth(), { user: null, returnTo: 'login' })
    assert.equal(calls.length, 1)
    assert.equal(auth.getNaverRegistration().returnTo, 'policy')
    assert.equal(storage.has('gage-auth-session'), false)
    assert.deepEqual(auth.getAuthHeaders(), {})
    assert.doesNotMatch(JSON.stringify([...storage]), /one-use/)
  })
})

test('verification email is bound to pending Naver identity, with no editable email payload', async t => {
  await withAuth(t, { registration: registration(), response: () => Response.json({ verificationId: 'a'.repeat(64), expiresIn: 600, resendAfter: 60 }) }, async ({ auth, calls, storage }) => {
    assert.deepEqual(await auth.initializeAuth(), { user: null })
    const pending = await auth.requestNaverSignupCode()
    assert.equal(pending.email, 'naver@example.com')
    assert.equal(pending.challenge.id, 'a'.repeat(64))
    assert.equal(calls[0].path, '/api/auth/naver/email-code')
    assert.deepEqual(JSON.parse(calls[0].options.body), { registrationToken: 'b'.repeat(64) })
    assert.equal(storage.has('gage-auth-session'), false)
    assert.deepEqual(auth.getAuthHeaders(), {})
  })
})

test('successful verification checks user and restores original destination', async t => {
  await withAuth(t, { registration: challenged(), response: path => Response.json(path === '/api/users/me' ? { id: 42, name: '사장', email: 'naver@example.com' } : { accessToken: 'naver-token', tokenType: 'Bearer', expiresIn: 3600 }) }, async ({ auth, calls, storage }) => {
    const result = await auth.verifyNaverSignup('123456')
    assert.equal(result.user.id, 42)
    assert.equal(result.returnTo, 'customer')
    assert.deepEqual(calls.map(c => c.path), ['/api/auth/naver/verify', '/api/users/me'])
    assert.deepEqual(JSON.parse(calls[0].options.body), { registrationToken: 'b'.repeat(64), verificationId: 'a'.repeat(64), code: '123456' })
    assert.equal(calls[1].options.headers.Authorization, 'Bearer naver-token')
    assert.equal(storage.has('gage-naver-registration'), false)
    assert.equal(storage.has('gage-auth-session'), true)
    assert.doesNotMatch(JSON.stringify([...storage]), /123456/)
  })
})

test('invalid code permits retry without authenticating; expired registration is cleared', async t => {
  for (const code of ['INVALID_VERIFICATION', 'NAVER_REGISTRATION_EXPIRED']) {
    await withAuth(t, { registration: challenged(), response: () => Response.json({ code }, { status: 400 }) }, async ({ auth, storage }) => {
      await assert.rejects(auth.verifyNaverSignup('123456'), /인증/)
      assert.equal(storage.has('gage-auth-session'), false)
      assert.equal(storage.has('gage-naver-registration'), code === 'INVALID_VERIFICATION')
      assert.deepEqual(auth.getAuthHeaders(), {})
    })
  }
})

test('expired pending identity and malformed mail responses fail closed', async t => {
  await withAuth(t, { registration: { ...registration(), expiresAt: Date.now() - 1 } }, async ({ auth, calls, storage }) => {
    await assert.rejects(auth.requestNaverSignupCode(), /만료/)
    assert.equal(calls.length, 0)
    assert.equal(storage.size, 0)
  })
  await withAuth(t, { registration: registration(), response: () => Response.json({ verificationId: 'short', expiresIn: 600, resendAfter: 60 }) }, async ({ auth }) => {
    await assert.rejects(auth.requestNaverSignupCode(), /확인하지 못했어요/)
    assert.equal(auth.getNaverRegistration().challenge, undefined)
  })
})

test('OTP token is discarded if user lookup fails; logout also clears registration', async t => {
  await withAuth(t, { registration: challenged(), response: path => path === '/api/users/me' ? Response.json({}, { status: 401 }) : Response.json({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 600 }) }, async ({ auth, storage }) => {
    await assert.rejects(auth.verifyNaverSignup('123456'))
    assert.equal(storage.size, 0)
    assert.deepEqual(auth.getAuthHeaders(), {})
  })
  await withAuth(t, { registration: challenged() }, async ({ auth, storage }) => {
    auth.logout()
    assert.equal(storage.size, 0)
  })
})

test('login entry has only Naver authentication and no independent email or password fields', async () => {
  const { default: Login } = await server.ssrLoadModule('/src/pages/Login.tsx')
  const markup = renderToStaticMarkup(createElement(Login, { onBack() {}, returnTo: 'setup' }))
  assert.match(markup, /네이버로 로그인/)
  assert.doesNotMatch(markup, /type="(?:email|password)"|이메일로 로그인|회원가입하기/)
})
