import { checkedFetch, policyError, readPolicyStream, resolveStore, safePolicySources } from './policy-chat'
import type { PolicyMessage, PolicyUpdate } from './policy-chat'
import type { StoreProfile } from '../types'

export interface PolicyConversation {
  id: number
  storeId: number
  title: string
  createdAt: string
  updatedAt: string
}
export interface PolicyConversationDetail { conversation: PolicyConversation; messages: PolicyMessage[] }
const base = '/api/me/policy/conversations'
const invalid = () => new Error('저장된 대화 응답을 확인하지 못했어요. 다시 불러와 주세요.')
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
function summary(value: unknown): PolicyConversation {
  if (!object(value) || !Number.isSafeInteger(value.id) || Number(value.id) <= 0
    || !Number.isSafeInteger(value.storeId) || Number(value.storeId) <= 0 || typeof value.title !== 'string'
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))
    || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) throw invalid()
  return value as unknown as PolicyConversation
}
export async function listPolicyConversations(signal: AbortSignal): Promise<PolicyConversation[]> {
  const data: unknown = await (await checkedFetch(base, { method: 'GET', cache: 'no-store' }, signal)).json()
  if (!Array.isArray(data) || data.length > 5) throw invalid()
  return data.map(summary)
}
export async function createPolicyConversation(profile: StoreProfile, signal: AbortSignal): Promise<PolicyConversation> {
  const storeId = await resolveStore(profile, signal)
  return summary(await (await checkedFetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storeId }),
  }, signal)).json())
}
export async function getPolicyConversation(id: number, signal: AbortSignal): Promise<PolicyConversationDetail> {
  const data: unknown = await (await checkedFetch(`${base}/${id}`, { method: 'GET', cache: 'no-store' }, signal)).json()
  if (!object(data) || !Array.isArray(data.messages)) throw invalid()
  const conversation = summary(data.conversation)
  if (conversation.id !== id) throw invalid()
  const messages: PolicyMessage[] = data.messages.map((m) => {
    if (!object(m) || typeof m.id !== 'string' || !['user', 'assistant'].includes(String(m.role))
      || typeof m.content !== 'string' || !['pending', 'streaming', 'complete', 'error', 'stopped'].includes(String(m.status))) throw invalid()
    return { id: m.id, role: m.role as PolicyMessage['role'], content: m.content,
      status: m.status === 'pending' ? 'streaming' : m.status as PolicyMessage['status'], sources: safePolicySources(m.sources),
      error: m.status === 'error' ? policyError(m.errorCode) : undefined }
  })
  return { conversation, messages }
}
export async function askPolicyConversation(id: number, clientMessageId: string, question: string,
  onUpdate: (update: PolicyUpdate) => void, signal: AbortSignal) {
  const response = await checkedFetch(`${base}/${id}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ clientMessageId, question: question.trim() }),
  }, signal)
  return readPolicyStream(response, onUpdate, signal)
}
export async function stopPolicyConversation(id: number, clientMessageId: string) {
  await checkedFetch(`${base}/${id}/messages/${clientMessageId}/stop`, { method: 'POST' }, AbortSignal.timeout(15000))
}
