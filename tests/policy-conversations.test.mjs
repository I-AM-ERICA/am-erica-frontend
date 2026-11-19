import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
after(() => server.close())
const { listPolicyConversations, getPolicyConversation, createPolicyConversation, askPolicyConversation, stopPolicyConversation } = await server.ssrLoadModule('/src/services/policy-conversations.ts')
const { sendPolicyDigest } = await server.ssrLoadModule('/src/services/policy-reminder.ts')
const room = { id: 21, storeId: 8, title: '가게 정책 질문', createdAt: '2026-11-18T11:00:00Z', updatedAt: '2026-11-18T11:05:00Z' }
const signal = () => new AbortController().signal
const profile = { id: 8, name: '카페', owner: '사장', category: '카페', region: '경기 안산시' }
const json = data => Response.json(data)
function mockFetch(handler) {
  const old = globalThis.fetch
  globalThis.fetch = handler
  return () => { globalThis.fetch = old }
}

test('history comes from the authenticated API and preserves every message in a room', async () => {
  const messages = Array.from({ length: 52 }, (_, i) => ({ id: `message-${i}`, role: i % 2 ? 'assistant' : 'user', content: `내용 ${i}`, status: 'complete', sources: [{ title: '공고', url: 'https://example.com/policy' }, { title: 'unsafe', url: 'javascript:alert(1)' }] }))
  const calls = []
  const restore = mockFetch(async (path, init) => { calls.push({ path, init }); return json(path.endsWith('/21') ? { conversation: room, messages } : [room]) })
  try {
    assert.deepEqual(await listPolicyConversations(signal()), [room])
    const detail = await getPolicyConversation(21, signal())
    assert.equal(detail.messages.length, 52)
    assert.deepEqual(detail.messages[51].sources, [{ title: '공고', url: 'https://example.com/policy' }])
    assert.equal(calls[0].path, '/api/me/policy/conversations')
    assert.equal(calls[1].path, '/api/me/policy/conversations/21')
  } finally { restore() }
})

test('malformed history or server errors cannot appear as an empty saved conversation', async () => {
  for (const data of [null, {}, Array(6).fill(room), [{ ...room, id: -1 }]]) {
    const restore = mockFetch(async () => json(data))
    try { await assert.rejects(listPolicyConversations(signal())) } finally { restore() }
  }
  for (const data of [{ conversation: { ...room, id: 99 }, messages: [] }, { conversation: room, messages: [{ id: 'x', role: 'user', content: 'x', status: 'invalid' }] }]) {
    const restore = mockFetch(async () => json(data))
    try { await assert.rejects(getPolicyConversation(21, signal())) } finally { restore() }
  }
  const restore = mockFetch(async () => Response.json({ code: 'CHAT_NOT_FOUND' }, { status: 404 }))
  try { await assert.rejects(getPolicyConversation(21, signal()), /보관되지 않은 대화/) } finally { restore() }
})

test('new conversation uses persistent store ID and question API never trusts client history', async () => {
  const calls = []
  const restore = mockFetch(async (path, init) => {
    calls.push({ path, body: init.body ? JSON.parse(init.body) : null })
    if (path.endsWith('/messages')) return new Response('event: delta\ndata: {"text":"저장된 답변"}\n\nevent: done\ndata: {}\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
    if (path.endsWith('/stop')) return new Response(null, { status: 200 })
    return json(room)
  })
  try {
    assert.deepEqual(await createPolicyConversation(profile, signal()), room)
    assert.equal((await askPolicyConversation(21, 'request-uuid', ' 질문 ', () => {}, signal())).text, '저장된 답변')
    await stopPolicyConversation(21, 'request-uuid')
    assert.deepEqual(calls, [
      { path: '/api/me/policy/conversations', body: { storeId: 8 } },
      { path: '/api/me/policy/conversations/21/messages', body: { clientMessageId: 'request-uuid', question: '질문' } },
      { path: '/api/me/policy/conversations/21/messages/request-uuid/stop', body: null },
    ])
  } finally { restore() }
})

test('a failed DB commit never becomes a completed answer', async () => {
  const restore = mockFetch(async () => new Response('event: delta\ndata: {"text":"저장 안 된 답변"}\n\nevent: error\ndata: {"code":"CHAT_SAVE_FAILED"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } }))
  try { await assert.rejects(askPolicyConversation(21, 'uuid', '질문', () => {}, signal()), /DB에 저장하지 못했어요/) } finally { restore() }
})

test('mail search from a conversation uses server-owned room and an idempotency ID', async () => {
  const calls = []
  const restore = mockFetch(async (path, init) => { calls.push({ path, body: JSON.parse(init.body) }); return json({ email: 'test@example.com', content: '정책 검색 결과' }) })
  try {
    await sendPolicyDigest(profile, signal(), 21)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].path, '/api/me/policy/conversations/21/email')
    assert.match(calls[0].body.clientMessageId, /^[0-9a-f-]{36}$/)
    assert.deepEqual(Object.keys(calls[0].body), ['clientMessageId'])
  } finally { restore() }
})
