import { saveManagementSales } from './managementApi'
import { apiFetch } from './api'
import { getAuthHeaders, logout } from './auth'
import type { StoreProfile } from '../types'

export interface SalesInput { date: string; amount: string }
export interface SalesPoint { date: string; amount: number }
export interface ForecastPoint { date: string; predicted: number; lower: number; upper: number }
export interface SalesForecast { historyDays: number; points: ForecastPoint[]; summary: string; model: string }
export type SalesPredictor = (history: SalesPoint[], horizonDays: number, profile: StoreProfile, signal: AbortSignal) => Promise<SalesForecast>

export function todayInSeoul(): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (name: string) => parts.find((item) => item.type === name)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function validateSales(rows: SalesInput[], today = todayInSeoul()): SalesPoint[] {
  if (rows.length < 1 || rows.length > 512) throw new Error('매출은 최소 1일, 최대 512일까지 입력할 수 있어요.')
  const history = rows.map((row, index) => {
    if (!validDate(row.date) || row.date > today) throw new Error(`${index + 1}행의 날짜를 확인해 주세요. 실제 매출은 오늘까지 입력할 수 있어요.`)
    const raw = row.amount.trim()
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error(`${index + 1}행의 매출을 0 이상의 원 단위 정수로 입력해 주세요.`)
    return { date: row.date, amount: Number(raw) }
  }).sort((a, b) => a.date.localeCompare(b.date))
  for (let index = 1; index < history.length; index++) {
    if (history[index].date === history[index - 1].date) throw new Error('같은 날짜가 중복되어 있어요. 하루의 총매출을 한 행에 입력해 주세요.')
    if (history[index].date !== shiftDate(history[index - 1].date, 1)) throw new Error('매출 날짜를 연속해서 입력해 주세요. 휴무일은 0원으로 입력하면 됩니다.')
  }
  return history
}
export function parseSalesForecast(value: unknown, history: SalesPoint[], horizonDays: number): SalesForecast {
  if (!value || typeof value !== 'object') throw new Error('예측 결과 형식을 확인하지 못했어요.')
  const data = value as Record<string, unknown>
  if (typeof data.model !== 'string' || !data.model.startsWith('chronos-')) throw new Error('실제 Chronos 모델이 연결되지 않았어요. 경영 비서 서버 연결을 확인해 주세요.')
  if (data.historyDays !== history.length || typeof data.summary !== 'string' || !Array.isArray(data.points) || data.points.length !== horizonDays) throw new Error('요청한 기간과 예측 결과가 일치하지 않아요.')
  const lastDate = history[history.length - 1].date
  const points = data.points.map((value, index) => {
    const point = value as ForecastPoint | null
    if (!point || point.date !== shiftDate(lastDate, index + 1)
      || ![point.predicted, point.lower, point.upper].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)
      || point.lower > point.predicted || point.predicted > point.upper) throw new Error('예측 날짜 또는 금액을 확인하지 못했어요.')
    return { date: point.date, predicted: point.predicted, lower: point.lower, upper: point.upper }
  })
  return { historyDays: data.historyDays as number, points, summary: data.summary, model: data.model }
}
export const predictSales: SalesPredictor = async (history, horizonDays, profile, signal) => {
  if (!Number.isSafeInteger(profile.id) || profile.id! <= 0) throw new Error('가게 정보를 먼저 저장해 주세요.')
  await saveManagementSales(profile.id!, history, signal)
  const response = await apiFetch(`/api/stores/${profile.id}/ai/management/forecast`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ history, horizonDays }), signal,
  })
  if (response.status === 401) { logout(); throw new Error('로그인이 만료되었어요. 다시 로그인해 주세요.') }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: '입력한 날짜와 매출을 확인해 주세요. 날짜는 중복 없이 연속되어야 해요.',
      403: '이 가게의 매출을 예측할 권한이 없어요.', 404: '가게 정보를 찾지 못했어요.',
      422: '하루 이상의 매출을 입력해 주세요.', 429: '예측 요청이 많아요. 잠시 후 다시 시도해 주세요.',
      502: '경영 비서가 예측을 완료하지 못했어요. 모델 연결을 확인해 주세요.',
      503: '경영 비서 서버에 연결하지 못했어요.', 504: '예측 시간이 초과됐어요. 다시 시도해 주세요.',
    }
    throw new Error(messages[response.status] || '매출 예측에 실패했어요. 잠시 후 다시 시도해 주세요.')
  }
  return parseSalesForecast(await response.json(), history, horizonDays)
}
