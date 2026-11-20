import { apiFetch } from './api'
import { getAuthHeaders, logout } from './auth'
import { resolveStore } from './policy-chat'
import type { StoreProfile } from '../types'

export interface PolicyReminderSettings {
  enabled: boolean
  email: string | null
  storeId: number | null
  storeName: string | null
  deliveryConfigured: boolean
  manualDeliveryConfigured: boolean
  lastSentDate: string | null
}
async function request(init: RequestInit, signal: AbortSignal): Promise<PolicyReminderSettings> {
  const response = await apiFetch('/api/me/policy-reminder', { ...init, headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, signal })
  if (response.status === 401) { logout(); throw new Error('로그인이 만료되었어요. 다시 로그인해 주세요.') }
  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    if (problem?.code === 'EMAIL_REQUIRED') throw new Error('네이버 로그인에서 이메일 제공에 동의한 뒤 다시 로그인해 주세요.')
    throw new Error('알림 설정을 저장하거나 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('enabled' in data) || typeof data.enabled !== 'boolean'
      || !('deliveryConfigured' in data) || typeof data.deliveryConfigured !== 'boolean'
      || !('manualDeliveryConfigured' in data) || typeof data.manualDeliveryConfigured !== 'boolean'
      || !('email' in data) || (data.email !== null && typeof data.email !== 'string')
      || !('storeId' in data) || (data.storeId !== null && (!Number.isSafeInteger(data.storeId) || Number(data.storeId) <= 0))
      || !('storeName' in data) || (data.storeName !== null && typeof data.storeName !== 'string')
      || !('lastSentDate' in data) || (data.lastSentDate !== null && typeof data.lastSentDate !== 'string')) {
    throw new Error('알림 설정 응답을 확인하지 못했어요.')
  }
  return data as PolicyReminderSettings
}
export function getPolicyReminder(signal: AbortSignal) { return request({ method: 'GET' }, signal) }
export async function setPolicyReminder(enabled: boolean, profile: StoreProfile, signal: AbortSignal) {
  const storeId = enabled ? await resolveStore(profile, signal) : undefined
  return request({ method: 'PUT', body: JSON.stringify({ enabled, storeId }) }, signal)
}

export interface PolicyDeliveryResult { email: string; content: string }
export async function sendPolicyDigest(profile: StoreProfile, signal: AbortSignal, conversationId?: number): Promise<PolicyDeliveryResult> {
  const storeId = conversationId ? undefined : await resolveStore(profile, signal)
  const response = await apiFetch(conversationId ? `/api/me/policy/conversations/${conversationId}/email` : '/api/me/policy-reminder/send-now', {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(conversationId ? { clientMessageId: crypto.randomUUID() } : { storeId }), signal,
  })
  if (response.status === 401) { logout(); throw new Error('로그인이 만료되었어요. 다시 로그인해 주세요.') }
  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    const errors: Record<string, string> = {
      EMAIL_REQUIRED: '네이버 로그인에서 이메일 제공에 동의해 주세요.',
      MAIL_NOT_CONFIGURED: '이메일 발송 설정이 아직 준비되지 않았어요.',
      AI_UNAVAILABLE: '정책 검색 서버에 연결하지 못해 메일을 보내지 않았어요.',
      AI_TIMEOUT: '정책 검색 시간이 초과되어 메일을 보내지 않았어요.',
      AI_BUSY: '정책 검색 서버가 혼잡해 메일을 보내지 않았어요.',
      AI_EMPTY_RESULT: '정책 검색 결과가 비어 있어 메일을 보내지 않았어요.',
      AI_INVALID_REQUEST: '확인 가능한 정책 검색 결과를 얻지 못해 메일을 보내지 않았어요.',
      AI_AUTH_FAILED: '정책 검색 서버의 인증 설정을 확인해야 해요. 메일은 보내지 않았어요.',
      AI_SEARCH_LIMIT: '정책 검색 서비스의 이용 한도에 도달해 메일을 보내지 않았어요. 한도 복구 후 다시 시도해 주세요.',
      AI_MODEL_REQUIRED: '실제 정책 모델 연결이 필요해요. 예시 응답은 메일로 보내지 않아요.',
      AI_NO_SOURCES: '검색 출처를 확인하지 못해 메일을 보내지 않았어요. 잠시 후 다시 시도해 주세요.',
      AI_NOT_FOUND: '관련 정책 자료를 찾지 못해 메일을 보내지 않았어요.',
      AI_ERROR: '정책 모델이 검색을 완료하지 못해 메일을 보내지 않았어요.',
      STORE_NOT_FOUND: '현재 계정의 가게 정보를 다시 확인해 주세요.',
    }
    throw new Error(typeof problem?.code === 'string' && Object.hasOwn(errors, problem.code)
      ? errors[problem.code] : '메일 발송 결과를 확인하지 못했어요. 다시 누르기 전에 받은메일함을 확인해 주세요.')
  }
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('email' in data) || typeof data.email !== 'string' || !data.email.trim()
      || !('content' in data) || typeof data.content !== 'string' || !data.content.trim()) {
    throw new Error('발송 응답을 확인하지 못했어요. 다시 누르기 전에 받은메일함을 확인해 주세요.')
  }
  return { email: data.email, content: data.content }
}
