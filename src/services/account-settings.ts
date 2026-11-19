import { getAuthHeaders, logout } from './auth'
import { isStaffPreferences } from './staff'
import type { StaffGender, StaffPreferences } from './staff'
import type { AssistantId, StoreProfile } from '../types'

export interface AccountSettings { store: StoreProfile | null; staffPreferences: StaffPreferences }
function parseSettings(value: unknown): AccountSettings {
  if (!value || typeof value !== 'object') throw new Error('저장된 설정을 확인하지 못했어요.')
  const data = value as Record<string, unknown>
  if (!isStaffPreferences(data.staffPreferences)) throw new Error('비서 선택 정보를 확인하지 못했어요.')
  if (data.store === null) return { store: null, staffPreferences: data.staffPreferences }
  const store = data.store as Record<string, unknown> | null
  if (!store || typeof store !== 'object' || !Number.isSafeInteger(store.id) || Number(store.id) <= 0
    || !['name', 'owner', 'category', 'region'].every((key) => typeof store[key] === 'string' && (store[key] as string).trim())
    || (store.address != null && typeof store.address !== 'string')) {
    throw new Error('매장 정보를 확인하지 못했어요.')
  }
  return { store: store as unknown as StoreProfile, staffPreferences: data.staffPreferences }
}
async function request(path: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { ...init, headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), cache: 'no-store' })
  if (response.status === 401) { logout(); throw new Error('로그인이 만료되었어요. 다시 로그인해 주세요.') }
  if (!response.ok) throw new Error('계정 설정을 저장하거나 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
  return response.json()
}
export async function loadAccountSettings(signal: AbortSignal): Promise<AccountSettings> {
  return parseSettings(await request('/api/me/settings', { method: 'GET' }, signal))
}
export async function saveStoreProfile(profile: StoreProfile, signal: AbortSignal): Promise<AccountSettings> {
  const { name, owner, category, region, address } = profile
  const result = parseSettings(await request('/api/me/store-profile', {
    method: 'PUT', body: JSON.stringify({ name: name.trim(), owner: owner.trim(), category: category.trim(), region: region.trim(), ...(typeof address === 'string' ? { address: address.trim() } : {}) }),
  }, signal))
  if (!result.store) throw new Error('매장 저장 결과를 확인하지 못했어요.')
  if (address?.trim() && result.store.address !== address.trim()) throw new Error('주소 저장 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.')
  return result
}
export async function saveStaffPreference(assistant: AssistantId, gender: StaffGender, signal: AbortSignal): Promise<StaffPreferences> {
  const result = await request(`/api/me/staff-preferences/${assistant}`, { method: 'PATCH', body: JSON.stringify({ gender }) }, signal)
  if (!isStaffPreferences(result)) throw new Error('비서 선택 저장 결과를 확인하지 못했어요.')
  return result
}
