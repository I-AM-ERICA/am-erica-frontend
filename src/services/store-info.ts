import type { StoreProfile } from '../types'

// Preserve guides entered before account-backed settings were introduced.
export function getStoreInfo(profile: StoreProfile): string {
  if (typeof profile.storeInfo === 'string') return profile.storeInfo
  if (!profile.id || !Number.isSafeInteger(profile.id) || profile.id <= 0) return ''
  try { return localStorage.getItem(`gage-customer-store-info-${profile.id}`) ?? '' }
  catch { return '' }
}
export function clearLegacyStoreInfo(profile: StoreProfile): void {
  if (!profile.id) return
  try { localStorage.removeItem(`gage-customer-store-info-${profile.id}`) }
  catch { /* Account settings remain the source of truth when storage is unavailable. */ }
}
