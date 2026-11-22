import { apiFetch } from './api'
import { getAuthHeaders, logout } from './auth'
import { parsePlan } from './management'
import type { ManagementPlan } from './management'
import type { SalesPoint } from './sales'

export interface ManagementSnapshot {
  revision: number; plan: ManagementPlan; emailReady: boolean; recipient: string | null
  lastDeliveryMonth: string | null; lastDeliveryStatus: string | null
}
async function request(storeId: number, path: string, body?: unknown, signal?: AbortSignal) {
  if (!Number.isSafeInteger(storeId) || storeId <= 0) throw new Error('가게 정보를 먼저 저장해 주세요.')
  const response = await apiFetch(`/api/stores/${storeId}/management/${path}`, {
    method: body === undefined ? 'GET' : 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body), signal,
  })
  if (response.status === 401) { logout(); throw new Error('로그인이 만료되었어요. 다시 로그인해 주세요.') }
  if (!response.ok) {
    if (response.status === 409) throw new Error('다른 화면에서 경영 정보가 변경됐어요. 현재 입력을 보관한 뒤 새로고침해 주세요.')
    if (response.status === 400) throw new Error('입력 형식 또는 메일 수신 설정을 확인해 주세요.')
    if ([403, 404].includes(response.status)) throw new Error('가게 정보와 접근 권한을 확인해 주세요.')
    throw new Error('경영 정보를 저장하거나 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  return response
}
function snapshot(data: ManagementSnapshot): ManagementSnapshot {
  if (!data || !Number.isSafeInteger(data.revision) || data.revision < 0 || typeof data.emailReady !== 'boolean') throw new Error('경영 정보 응답을 확인하지 못했어요.')
  return { ...data, plan: parsePlan(JSON.stringify(data.plan)) }
}
export async function loadManagement(storeId: number, signal?: AbortSignal) {
  return snapshot(await (await request(storeId, 'plan', undefined, signal)).json())
}
export async function saveManagement(storeId: number, revision: number, plan: ManagementPlan, signal?: AbortSignal) {
  return snapshot(await (await request(storeId, 'plan', { revision, plan: parsePlan(JSON.stringify(plan)) }, signal)).json())
}
export async function saveManagementSales(storeId: number, history: SalesPoint[], signal?: AbortSignal) {
  await request(storeId, 'sales', { history }, signal)
}
export async function loadManagementSales(storeId: number, signal?: AbortSignal): Promise<SalesPoint[]> {
  const data = await (await request(storeId, 'sales', undefined, signal)).json()
  if (!Array.isArray(data) || data.length > 512 || data.some(p => !p || typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !Number.isSafeInteger(p.amount) || p.amount < 0)) throw new Error('저장된 매출 형식을 확인하지 못했어요.')
  return data
}
