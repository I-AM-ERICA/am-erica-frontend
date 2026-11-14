import { getAuthHeaders, logout } from './auth'
import { resolveStore } from './policy-chat'
import type { StoreProfile } from '../types'

export interface PolicyReminderSettings {
  enabled: boolean
  email: string | null
  storeId: number | null
  storeName: string | null
  deliveryConfigured: boolean
  lastSentDate: string | null
}
async function request(init: RequestInit, signal: AbortSignal): Promise<PolicyReminderSettings> {
  const response = await fetch('/api/me/policy-reminder', { ...init, headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, signal })
  if (response.status === 401) { logout(); throw new Error('로그인이 만료되었어요. 다시 로그인해 주세요.') }
  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    if (problem?.code === 'EMAIL_REQUIRED') throw new Error('네이버 로그인에서 이메일 제공에 동의한 뒤 다시 로그인해 주세요.')
    throw new Error('알림 설정을 저장하거나 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('enabled' in data) || typeof data.enabled !== 'boolean'
      || !('deliveryConfigured' in data) || typeof data.deliveryConfigured !== 'boolean'
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
