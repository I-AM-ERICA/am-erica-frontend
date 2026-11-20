import { apiFetch } from './api'
import { getAuthHeaders, logout } from './auth'
import type { AssistantResult, StoreProfile } from '../types'

export type PolicySource = NonNullable<AssistantResult['sources']>[number]
export interface PolicyMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'complete' | 'streaming' | 'error' | 'stopped'
  sources?: PolicySource[]
  error?: string
}
export interface PolicyTurn { role: 'user' | 'assistant'; content: string }
export interface PolicyUpdate { text: string; sources: PolicySource[] }
const MAX_ANSWER_LENGTH = 100000

export function policyHistory(messages: PolicyMessage[]): PolicyTurn[] {
  const turns: PolicyTurn[] = []
  let latestSources: PolicySource[] = []
  for (let i = 0; i < messages.length - 1; i++) {
    const user = messages[i], assistant = messages[i + 1]
    if (user.role === 'user' && assistant.role === 'assistant' && assistant.status === 'complete' && assistant.content.trim()) {
      turns.push({ role: 'user', content: user.content.slice(0, 2000) }, { role: 'assistant', content: assistant.content.slice(0, 2000) })
      latestSources = safePolicySources(assistant.sources)
      i++
    }
  }
  // Preserve source URLs across follow-ups without changing the backend/proto contract.
  // These are hints only: the GPU must fetch their bodies again before using them.
  const urls = latestSources.filter(source => source.url.startsWith('https:') && source.url.length <= 700)
    .slice(0, 2).map(source => `이전 답변 출처 URL: ${source.url}`).join('\n')
  if (urls && turns.length) {
    const last = turns[turns.length - 1]
    last.content = `${last.content.slice(0, 2000 - urls.length - 2)}\n\n${urls}`
  }
  return turns.slice(-8)
}

export function safePolicySources(value: unknown): PolicySource[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): PolicySource[] => {
    if (!item || typeof item.title !== 'string' || typeof item.url !== 'string') return []
    try {
      const url = new URL(item.url)
      return ['https:', 'http:'].includes(url.protocol) ? [{ title: item.title.slice(0, 300), url: url.href }] : []
    } catch { return [] }
  }).slice(0, 10)
}

export function readPolicyConversation(key: string): PolicyMessage[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.slice(-40).flatMap((item): PolicyMessage[] => {
      if (!item || typeof item.id !== 'string' || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || !['complete', 'streaming', 'error', 'stopped'].includes(item.status)) return []
      return [{ id: item.id, role: item.role, content: item.content.slice(0, MAX_ANSWER_LENGTH), status: item.status === 'streaming' ? 'stopped' : item.status, sources: safePolicySources(item.sources), error: typeof item.error === 'string' ? item.error : undefined }]
    })
  } catch { return [] }
}

export function savePolicyConversation(key: string, messages: PolicyMessage[]): boolean {
  try { localStorage.setItem(key, JSON.stringify(messages.slice(-40))); return true } catch { return false }
}

const policyErrors: Record<string, string> = {
  CHAT_NOT_FOUND: '보관되지 않은 대화예요. 최근 대화 목록을 다시 불러와 주세요.',
  CHAT_BUSY: '이 대화에서 답변을 작성 중이에요. 잠시 후 다시 불러와 주세요.',
  CHAT_SAVE_FAILED: '답변을 DB에 저장하지 못했어요. 대화를 다시 불러와 저장 상태를 확인해 주세요.',
  CHAT_INTERRUPTED: '답변 처리가 중단되었어요. 다시 질문해 주세요.',
  AI_SEARCH_LIMIT: '정책 검색 서비스의 이용 한도에 도달했어요. 한도 복구 후 다시 이용해 주세요.',
  AI_UNAVAILABLE: '정책 검색에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  AI_TIMEOUT: '답변 준비 시간이 초과됐어요. 질문을 조금 더 구체적으로 적어 다시 시도해 주세요.',
  AI_BUSY: '정책 비서가 다른 질문을 처리 중이에요. 잠시 후 다시 시도해 주세요.',
  AI_INVALID_REQUEST: '확인 가능한 자료나 완성된 답변을 얻지 못했어요. 정책명이나 기관명을 포함해 다시 질문해 주세요.',
  AI_NOT_FOUND: '관련 정책 자료를 찾지 못했어요. 검색 범위를 바꿔 질문해 주세요.',
  AI_AUTH_FAILED: '정책 비서 연결 설정을 확인해야 해요. 관리자에게 알려 주세요.',
  VALIDATION_FAILED: '질문은 1,000자 이내로 입력해 주세요. 가게 정보도 확인해 주세요.',
}
export function policyError(code: unknown): string {
  return typeof code === 'string' && Object.hasOwn(policyErrors, code)
    ? policyErrors[code]
    : '정책 비서 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.'
}

export async function checkedFetch(path: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  const headers = { ...getAuthHeaders(), ...init.headers }
  const response = await apiFetch(path, { ...init, headers, signal })
  if (response.status === 401) { logout(); throw new Error('로그인이 만료되었어요. 다시 로그인해 주세요.') }
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { code?: string } | null
    throw new Error(policyError(problem?.code))
  }
  return response
}

// Reuse this account's matching store; never send another account's cached store ID.
export async function resolveStore(profile: StoreProfile, signal: AbortSignal): Promise<number> {
  // Account settings supplies the persistent store ID. Renaming a store must not create another one.
  if (Number.isSafeInteger(profile.id) && profile.id! > 0) return profile.id!
  const response = await checkedFetch('/api/stores', { method: 'GET' }, signal)
  const stores: unknown = await response.json()
  if (!Array.isArray(stores)) throw new Error('가게 정보를 확인하지 못했어요.')
  const matching = stores.find((store) => store && Number.isSafeInteger(store.id) && store.id > 0 && store.name === profile.name && store.category === profile.category && store.region === profile.region)
  if (matching) return matching.id
  const created = await checkedFetch('/api/stores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: profile.name, category: profile.category, region: profile.region }) }, signal)
  const store = await created.json() as { id?: number } | null
  if (!store || !Number.isSafeInteger(store.id) || store.id! <= 0) throw new Error('가게 정보를 저장하지 못했어요.')
  return store.id!
}

export async function readPolicyStream(response: Response, onUpdate: (update: PolicyUpdate) => void, signal: AbortSignal): Promise<PolicyUpdate> {
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream') || !response.body) throw new Error('정책 비서 응답 형식이 올바르지 않아요.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '', text = '', sources: PolicySource[] = [], done = false
  const abort = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })
  const processEvent = (block: string) => {
    let event = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
    }
    if (!data.length) return
    if (!['delta', 'sources', 'done', 'error'].includes(event)) return
    let payload: unknown
    try { payload = JSON.parse(data.join('\n')) } catch { throw new Error('정책 비서 응답을 읽지 못했어요. 다시 시도해 주세요.') }
    if (event === 'error') throw new Error(policyError(payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined))
    if (event === 'done') { done = true; return }
    if (event === 'delta') {
      if (!payload || typeof payload !== 'object' || !('text' in payload) || typeof payload.text !== 'string') throw new Error('정책 비서 응답 형식이 올바르지 않아요.')
      text += payload.text
      if (text.length > MAX_ANSWER_LENGTH) throw new Error('답변이 너무 길어요. 질문 범위를 좁혀 다시 시도해 주세요.')
    } else sources = safePolicySources(payload)
    onUpdate({ text, sources })
  }
  try {
    while (!done) {
      signal.throwIfAborted()
      const chunk = await reader.read()
      signal.throwIfAborted()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      // Keep a trailing CR until the next chunk so split CRLFs remain intact.
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r(?!$)/g, '\n')
      let boundary: number
      while (!done && (boundary = buffer.indexOf('\n\n')) >= 0) {
        processEvent(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 2)
      }
      if (buffer.length > MAX_ANSWER_LENGTH) throw new Error('정책 비서 응답 형식이 올바르지 않아요.')
      if (chunk.done) break
    }
    if (!done || !text.trim()) throw new Error('답변을 끝까지 받지 못했어요. 다시 시도해 주세요.')
    return { text, sources }
  } finally {
    signal.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export async function askPolicy(question: string, history: PolicyTurn[], profile: StoreProfile, onUpdate: (update: PolicyUpdate) => void, signal: AbortSignal): Promise<PolicyUpdate> {
  if (!question.trim() || question.length > 1000) throw new Error('질문은 1~1,000자로 입력해 주세요.')
  const storeId = await resolveStore(profile, signal)
  const response = await checkedFetch(`/api/stores/${storeId}/ai/policy/stream`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ question: question.trim(), topK: 3, history }),
  }, signal)
  return readPolicyStream(response, onUpdate, signal)
}
