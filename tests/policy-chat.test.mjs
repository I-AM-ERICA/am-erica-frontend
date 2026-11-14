import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
after(() => server.close())
const { readPolicyStream, policyHistory, askPolicy, readPolicyConversation, savePolicyConversation } = await server.ssrLoadModule('/src/services/policy-chat.ts')
const encoder = new TextEncoder()
function responseFor(text, stride = 7) {
  const bytes = encoder.encode(text)
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += stride) controller.enqueue(bytes.slice(i, i + stride))
    controller.close()
  } }), { headers: { 'Content-Type': 'text/event-stream; charset=UTF-8' } })
}
const completed = 'event: delta\ndata: {"text":"지원 정책 답변"}\n\nevent: done\ndata: {}\n\n'

test('SSE decodes Korean split across bytes, CRLF frames, sources and completion', async () => {
  const stream = ': heartbeat\r\n\r\nevent: delta\r\ndata: {"text":"카페 "}\r\n\r\nevent: delta\r\ndata: {"text":"지원금"}\r\n\r\nevent: sources\r\ndata: [{"title":"공식 공고","url":"https://example.com/policy"},{"title":"unsafe","url":"javascript:alert(1)"}]\r\n\r\nevent: done\r\ndata: {}\r\n\r\n'
  const updates = []
  const result = await readPolicyStream(responseFor(stream, 1), (update) => updates.push(update), new AbortController().signal)
  assert.equal(result.text, '카페 지원금')
  assert.deepEqual(result.sources, [{ title: '공식 공고', url: 'https://example.com/policy' }])
  assert.ok(updates.some((update) => update.text === '카페 '))
})

test('partial stream, invalid data, empty completion and error events cannot become saved answers', async () => {
  for (const text of ['event: delta\ndata: {"text":"partial"}\n\n', 'event: delta\ndata: invalid\n\n', 'event: done\ndata: {}\n\n', 'event: delta\ndata: {"text":"partial"}\n\nevent: error\ndata: {"message":"private error"}\n\n', 'event: delta\ndata: {}\n\n']) {
    await assert.rejects(readPolicyStream(responseFor(text), () => {}, new AbortController().signal), (error) => !error.message.includes('private error'))
  }
})

test('stop cancels an in-flight reader and rejects the unfinished result', async () => {
  const controller = new AbortController()
  let cancelled = false
  const response = new Response(new ReadableStream({ cancel() { cancelled = true } }), { headers: { 'Content-Type': 'text/event-stream' } })
  const pending = readPolicyStream(response, () => {}, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(cancelled, true)
})

test('only completed question-answer pairs enter bounded conversation context', () => {
  const messages = []
  for (let i = 0; i < 6; i++) messages.push({ id: `u${i}`, role: 'user', content: `question ${i}`, status: 'complete' }, { id: `a${i}`, role: 'assistant', content: 'x'.repeat(3000), status: i === 5 ? 'error' : 'complete' })
  const history = policyHistory(messages)
  assert.equal(history.length, 8)
  assert.equal(history[0].content, 'question 1')
  assert.equal(history.at(-1).content.length, 2000)
  assert.ok(!history.some((turn) => turn.content === 'question 5'))
})

test('stream API reuses matching owned store and forwards current query and history', async (t) => {
  const calls = []
  const profile = { name: '내 가게', category: '카페', region: '서울', owner: '사장' }
  const history = [{ role: 'user', content: '지원금은?' }, { role: 'assistant', content: '정책자금이 있어요.' }]
  t.mock.method(globalThis, 'fetch', async (path, init) => {
    calls.push({ path, init })
    return path === '/api/stores' ? Response.json([{ id: 7, ...profile }]) : responseFor(completed)
  })
  const result = await askPolicy('신청 서류는?', history, profile, () => {}, new AbortController().signal)
  assert.equal(result.text, '지원 정책 답변')
  assert.deepEqual(calls.map((call) => call.path), ['/api/stores', '/api/stores/7/ai/policy/stream'])
  assert.deepEqual(JSON.parse(calls[1].init.body), { question: '신청 서류는?', topK: 3, history })
})

test('first chat registers current store and never chooses another store arbitrarily', async (t) => {
  const calls = []
  const profile = { name: '새 가게', category: '카페', region: '서울', owner: '사장' }
  t.mock.method(globalThis, 'fetch', async (path, init) => {
    calls.push({ path, init })
    if (path === '/api/stores') return init.method === 'GET' ? Response.json([{ id: 9, name: '다른 가게', category: '카페', region: '서울' }]) : Response.json({ id: 12 })
    return responseFor(completed)
  })
  await askPolicy('지원금은?', [], profile, () => {}, new AbortController().signal)
  assert.equal(calls[1].init.method, 'POST')
  assert.deepEqual(JSON.parse(calls[1].init.body), { name: '새 가게', category: '카페', region: '서울' })
  assert.equal(calls[2].path, '/api/stores/12/ai/policy/stream')
})

test('a backend failure stays an error instead of silently using demo text', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ code: 'AI_UNAVAILABLE' }, { status: 503 }))
  await assert.rejects(askPolicy('지원금은?', [], { name: '가게', category: '카페', region: '서울' }, () => {}, new AbortController().signal), /연결하지 못했어요/)
})

test('stored interrupted replies restore as stopped and storage keys stay isolated', () => {
  const original = globalThis.localStorage
  const values = new Map()
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  try {
    savePolicyConversation('user-1', [{ id: 'a', role: 'assistant', content: 'partial', status: 'streaming' }])
    assert.equal(readPolicyConversation('user-1')[0].status, 'stopped')
    assert.deepEqual(readPolicyConversation('user-2'), [])
    values.set('invalid', '{bad')
    assert.deepEqual(readPolicyConversation('invalid'), [])
  } finally { globalThis.localStorage = original }
})

test('policy page renders chat composer, empty prompts and new-conversation action', async () => {
  const { default: PolicyChatPage } = await server.ssrLoadModule('/src/pages/PolicyChatPage.tsx')
  const noop = () => {}
  const markup = renderToStaticMarkup(createElement(PolicyChatPage, { profile: { name: '가게' }, storageKey: 'test-chat', onBack: noop, onSave: noop, onToast: noop }))
  assert.match(markup, /정책 비서 채팅/)
  assert.match(markup, /정책 비서에게 질문하기/)
  assert.match(markup, /새 대화/)
  assert.match(markup, /질문 보내기/)
  assert.doesNotMatch(markup, /수정 가능한 작업 결과/)
})


test('SSE failures show safe recovery guidance without exposing provider messages', async () => {
  for (const [code, expected] of [['AI_INVALID_REQUEST', /정책명이나 기관명/], ['AI_BUSY', /다른 질문/], ['AI_TIMEOUT', /초과/]]) {
    const body = `event: error\ndata: ${JSON.stringify({ code, message: 'private provider details' })}\n\n`
    await assert.rejects(readPolicyStream(responseFor(body), () => {}, new AbortController().signal), error => expected.test(error.message) && !error.message.includes('private'))
  }
})

test('policy header and replies use the selected policy staff portrait', async () => {
  const { default: StaffAvatar } = await server.ssrLoadModule('/src/components/StaffAvatar.tsx')
  const { StaffPreferencesContext, defaultStaffPreferences } = await server.ssrLoadModule('/src/services/staff.ts')
  for (const gender of ['boy', 'girl']) {
    const markup = renderToStaticMarkup(createElement(StaffPreferencesContext.Provider,
      { value: { ...defaultStaffPreferences, policy: gender } }, createElement(StaffAvatar, { id: 'policy' })))
    assert.ok(markup.includes(`/staff/${gender}s/policy_${gender}.jpeg`))
    assert.match(markup, /<img/)
  }
})


test('follow-up history retains only latest completed answer source URLs within the turn limit', () => {
  const history = policyHistory([
    { role: 'user', content: '정책을 찾아줘', status: 'complete' },
    { role: 'assistant', content: 'a'.repeat(2000), status: 'complete', sources: [
      { title: '공식 공고', url: 'https://www.semas.or.kr/notice' },
      { title: 'unsafe', url: 'javascript:alert(1)' },
    ] },
    { role: 'user', content: '다른 질문', status: 'complete' },
    { role: 'assistant', content: '실패', status: 'error', sources: [{ title: 'failed', url: 'https://example.com/failed' }] },
  ])
  assert.equal(history.length, 2)
  assert.ok(history[1].content.length <= 2000)
  assert.match(history[1].content, /이전 답변 출처 URL: https:\/\/www.semas.or.kr\/notice/)
  assert.doesNotMatch(history[1].content, /javascript|failed/)
})
