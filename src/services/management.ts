import type { SalesForecast } from './sales'

export interface Employee { id: string; name: string; role: string; contact: string; hourlyWage: number }
export interface Shift { id: string; employeeId: string; date: string; start: string; end: string; breakMinutes: number }
export interface FixedCost { id: string; name: string; amount: number }
export interface MonthlyBudget { rent: number; costs: FixedCost[] }
export interface ManagementPlan { version: 1; employees: Employee[]; shifts: Shift[]; budgets: Record<string, MonthlyBudget>; emailRequested: boolean }
export const emptyPlan = (): ManagementPlan => ({ version: 1, employees: [], shifts: [], budgets: {}, emailRequested: false })
export const managementKey = (userId: number, storeId: number) => `gage-management:v1:${userId}:${storeId}`
export const money = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`
export function amount(value: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 1_000_000_000) throw new Error('금액은 0~10억 원 사이의 정수로 입력해 주세요.')
  return Number(value)
}
const minutes = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN
export function validDate(value: string): boolean {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function shiftMinutes(shift: Shift): number { return minutes(shift.end) - minutes(shift.start) - shift.breakMinutes }
export function validateShift(shift: Shift, plan: ManagementPlan) {
  if (!plan.employees.some((employee) => employee.id === shift.employeeId)) throw new Error('직원을 먼저 선택해 주세요.')
  if (!validDate(shift.date) || !Number.isFinite(minutes(shift.start)) || !Number.isFinite(minutes(shift.end))) throw new Error('근무 날짜와 시간을 확인해 주세요.')
  if (minutes(shift.end) <= minutes(shift.start)) throw new Error('퇴근은 출근 이후여야 해요. 자정을 넘는 근무는 날짜별로 나누어 입력해 주세요.')
  if (!Number.isInteger(shift.breakMinutes) || shift.breakMinutes < 0 || shiftMinutes(shift) <= 0) throw new Error('무급 휴게시간은 전체 근무시간보다 짧아야 해요.')
  if (plan.shifts.some((other) => other.id !== shift.id && other.employeeId === shift.employeeId && other.date === shift.date && minutes(shift.start) < minutes(other.end) && minutes(other.start) < minutes(shift.end))) throw new Error('같은 직원의 근무시간이 겹쳐요.')
}
export function payroll(plan: ManagementPlan, month: string) {
  return plan.employees.map((employee) => {
    const workedMinutes = plan.shifts.filter((shift) => shift.employeeId === employee.id && shift.date.startsWith(`${month}-`)).reduce((sum, shift) => sum + shiftMinutes(shift), 0)
    return { ...employee, minutes: workedMinutes, pay: Math.round(workedMinutes * employee.hourlyWage / 60) }
  })
}
export function revenueEstimate(forecast: SalesForecast | null, month: string) {
  // Only a forecast for this month can supply the reference daily average.
  const points = forecast?.points.filter((point) => point.date.startsWith(`${month}-`)) ?? []
  if (!points.length) return null
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()
  return { amount: Math.round(points.reduce((sum, point) => sum + point.predicted, 0) / points.length * days), sampleDays: points.length, days }
}
export function parsePlan(raw: string): ManagementPlan {
  const data = JSON.parse(raw) as ManagementPlan
  const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max
  const cash = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000_000
  if (!data || data.version !== 1 || !Array.isArray(data.employees) || data.employees.length > 100 || !Array.isArray(data.shifts) || data.shifts.length > 10000 || !data.budgets || typeof data.budgets !== 'object' || Array.isArray(data.budgets) || Object.keys(data.budgets).length > 120 || typeof data.emailRequested !== 'boolean') throw new Error('저장된 경영 정보 형식이 올바르지 않아요.')
  if (data.employees.some((e) => !e || !text(e.id, 100) || !e.id || !text(e.name, 40) || !e.name.trim() || !text(e.role, 60) || !text(e.contact, 80) || !cash(e.hourlyWage)) || new Set(data.employees.map((e) => e.id)).size !== data.employees.length) throw new Error('저장된 직원 정보를 확인해 주세요.')
  const checked: ManagementPlan = { ...data, shifts: [] }
  for (const shift of data.shifts) {
    if (!shift || !text(shift.id, 100) || !shift.id || checked.shifts.some((s) => s.id === shift.id)) throw new Error('저장된 근무표를 확인해 주세요.')
    validateShift(shift, checked); checked.shifts.push(shift)
  }
  for (const [month, budget] of Object.entries(data.budgets)) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || !budget || !cash(budget.rent) || !Array.isArray(budget.costs) || budget.costs.length > 100 || budget.costs.some((cost) => !cost || !text(cost.id, 100) || !cost.id || !text(cost.name, 60) || !cost.name.trim() || !cash(cost.amount)) || new Set(budget.costs.map((c) => c.id)).size !== budget.costs.length) throw new Error('저장된 고정비 정보를 확인해 주세요.')
  }
  return data
}
