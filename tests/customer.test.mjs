import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
after(() => server.close())
const { runAssistant } = await server.ssrLoadModule('/src/services/assistant.ts')
const profile = { id: 42, name: '우리 카페', owner: '사장님', category: '카페', region: '서울' }
const request = { message: '  음료가 늦었어요.  ', format: '리뷰 답글', profile }
test('customer uses the owned-store API even in demo mode and renders the model reply', async () => {
  const original = globalThis.fetch
  const signal = new AbortController().signal
  let sent
  globalThis.fetch = async (url, init) => { sent = { url, init }; return Response.json({ reply: '기다리게 해 드려 죄송합니다.', sentiment: 'negative', keywords: ['대기'] }) }
  try {
    assert.deepEqual(await runAssistant('customer', request, signal), { text: '기다리게 해 드려 죄송합니다.' })
    assert.equal(sent.url, '/api/stores/42/ai/customer/reply')
    assert.equal(sent.init.method, 'POST'); assert.equal(sent.init.signal, signal)
    assert.deepEqual(JSON.parse(sent.init.body), { reviewText: '음료가 늦었어요.', tone: '정중하고 따뜻하게' })
    assert.equal(sent.init.headers['Content-Type'], 'application/json')
  } finally { globalThis.fetch = original }
})
test('invalid store and review are rejected before transmission', async () => {
  const original = globalThis.fetch
  globalThis.fetch = () => { throw new Error('must not fetch') }
  try {
    for (const id of [undefined, 0, -1, '42']) await assert.rejects(runAssistant('customer', { ...request, profile: { ...profile, id } }), /가게 정보/)
    for (const message of ['', ' ', '가'.repeat(2001)]) await assert.rejects(runAssistant('customer', { ...request, message }), /2,000/)
  } finally { globalThis.fetch = original }
})
test('server failures and invalid replies never become a demo template', async () => {
  const original = globalThis.fetch
  try {
    for (const status of [401, 403, 404, 429, 502, 503, 504]) {
      globalThis.fetch = async () => new Response('{}', { status })
      await assert.rejects(runAssistant('customer', request), Error)
    }
    for (const body of [{}, { text: 'wrong field' }, { reply: '' }, { reply: 1 }]) {
      globalThis.fetch = async () => Response.json(body)
      await assert.rejects(runAssistant('customer', request), /답글을 받지/)
    }
  } finally { globalThis.fetch = original }
})
test('customer screen describes real generation and server transmission', async () => {
  const { default: AssistantPage } = await server.ssrLoadModule('/src/pages/AssistantPage.tsx')
  const noop = () => {}
  const html = renderToStaticMarkup(createElement(AssistantPage, { id: 'customer', profile, onBack: noop, onSave: noop, onToast: noop }))
  assert.match(html, /AI가 리뷰에 맞는 답글 초안/)
  assert.match(html, /서버로 전송/)
  assert.match(html, /maxLength="2000"/)
  assert.doesNotMatch(html, /예시 문안으로 체험|브라우저에만 보관/)
})
