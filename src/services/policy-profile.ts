import type { StoreProfile } from '../types'

export type PolicyProfileDraft = { region: string; ownerAge: string; employeeCount: string; monthlyRevenue: string }
export const policyProfileLimits = { ownerAge: 120, employeeCount: 1000000, monthlyRevenue: 1000000000000 } as const
export function policyProfileDraft(profile: StoreProfile): PolicyProfileDraft {
  return { region: profile.region === '지역 미설정' ? '' : profile.region,
    ownerAge: profile.ownerAge == null ? '' : String(profile.ownerAge),
    employeeCount: profile.employeeCount == null ? '' : String(profile.employeeCount),
    monthlyRevenue: profile.monthlyRevenue == null ? '' : String(profile.monthlyRevenue) }
}
export function validProfileNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}
export function parsePolicyProfile(draft: PolicyProfileDraft) {
  const region = draft.region.trim()
  if (!region || region === '지역 미설정' || region.length > 50) throw new Error('운영 지역을 시·도와 시·군·구까지 입력해 주세요.')
  const integer = (text: string, min: number, max: number, label: string) => {
    if (!/^\d+$/.test(text.trim()) || !validProfileNumber(Number(text), min, max)) throw new Error(`${label}을 ${min.toLocaleString()}~${max.toLocaleString()} 사이의 정수로 입력해 주세요.`)
    return Number(text)
  }
  return { region, ownerAge: integer(draft.ownerAge, 1, policyProfileLimits.ownerAge, '사장님 만 나이'),
    employeeCount: integer(draft.employeeCount, 0, policyProfileLimits.employeeCount, '직원 수'),
    monthlyRevenue: draft.monthlyRevenue.trim() === '' ? null : integer(draft.monthlyRevenue, 0, policyProfileLimits.monthlyRevenue, '월 매출') }
}
