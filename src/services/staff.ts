import { createContext } from 'react'
import type { AssistantId } from '../types'

export type StaffGender = 'boy' | 'girl'
export type StaffPreferences = Record<AssistantId, StaffGender>

export const defaultStaffPreferences: StaffPreferences = {
  policy: 'boy',
  marketing: 'girl',
  customer: 'girl',
  sales: 'boy',
}
export const StaffPreferencesContext = createContext<StaffPreferences>(defaultStaffPreferences)

const staffFiles: Record<AssistantId, string> = {
  policy: 'policy',
  marketing: 'advertise',
  customer: 'customer',
  sales: 'economic',
}
const defaultImageBaseUrl = 'https://iyfmiswfprjohqoffugb.supabase.co/storage/v1/object/public/frontend-image/staff'

export function getStaffImageUrl(id: AssistantId, gender: StaffGender): string {
  const baseUrl = (import.meta.env.VITE_STAFF_IMAGE_BASE_URL?.trim() || defaultImageBaseUrl).replace(/\/+$/, '')
  return `${baseUrl}/${gender}s/${staffFiles[id]}_${gender}.jpeg`
}

export function isStaffPreferences(value: unknown): value is StaffPreferences {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return Object.keys(defaultStaffPreferences).every((id) => record[id] === 'boy' || record[id] === 'girl')
}
