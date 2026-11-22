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
    assert.deepEqual(await runAssistant('customer', request, signal), { text: '기다리게 해 드려 죄송합니다.', customer: { rating: 0, sentiment: 'negative', keywords: ['대기'] } })
    assert.equal(sent.url, '/api/stores/42/ai/customer/reply')
    assert.equal(sent.init.method, 'POST'); assert.equal(sent.init.signal, signal)
    assert.deepEqual(JSON.parse(sent.init.body), { reviewText: '음료가 늦었어요.', rating: 0, tone: '정중하고 따뜻하게' })
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
  assert.doesNotMatch(html, /type="file"/)
  assert.match(html, /id="review-rating"/)
  assert.match(html, /value="0" selected=""/)
  for (let rating = 1; rating <= 5; rating++) assert.match(html, new RegExp(`value="${rating}"`))
  assert.match(html, /id="reply-tone"[^>]*maxLength="30"/)
  assert.match(html, /모름 \/ 선택 안 함/)
  assert.doesNotMatch(html, /예시 문안으로 체험|브라우저에만 보관/)
})

test('all ratings and a custom single-line tone reach the text-only API', async () => {
  const original = globalThis.fetch
  let sent
  globalThis.fetch = async (_url, init) => { sent = JSON.parse(init.body); return Response.json({ reply: '답글', sentiment: 'positive', keywords: ['맛', '친절'] }) }
  try {
    for (let rating = 0; rating <= 5; rating++) {
      const result = await runAssistant('customer', { ...request, rating, tone: '  친근하게\n간결하게  ' })
      assert.deepEqual(sent, { reviewText: '음료가 늦었어요.', rating, tone: '친근하게 간결하게' })
      assert.deepEqual(result.customer, { rating, sentiment: 'positive', keywords: ['맛', '친절'] })
    }
    await runAssistant('customer', { ...request, tone: '' })
    assert.equal(sent.tone, '')
  } finally { globalThis.fetch = original }
})
test('invalid ratings and overlong tone are rejected before sending', async () => {
  const original = globalThis.fetch
  globalThis.fetch = () => { throw new Error('must not fetch') }
  try {
    for (const rating of [-1, 6, 1.5, NaN, '5']) await assert.rejects(runAssistant('customer', { ...request, rating }), /별점/)
    for (const tone of ['가'.repeat(31), 42]) await assert.rejects(runAssistant('customer', { ...request, tone }), /말투/)
  } finally { globalThis.fetch = original }
})
test('metadata is optional and malformed fields do not break a usable reply', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => Response.json({ reply: '답글' })
    assert.deepEqual((await runAssistant('customer', request)).customer, { rating: 0, sentiment: undefined, keywords: [] })
    globalThis.fetch = async () => Response.json({ reply: '답글', sentiment: 'invented', keywords: [null, {}, ' ', ' 맛 ', '맛', '포장'] })
    assert.deepEqual((await runAssistant('customer', request)).customer, { rating: 0, sentiment: undefined, keywords: ['맛', '포장'] })
  } finally { globalThis.fetch = original }
})
test('result summary distinguishes unknown rating from neutral sentiment', async () => {
  const { default: Summary } = await server.ssrLoadModule('/src/components/CustomerReplySummary.tsx')
  const render = result => renderToStaticMarkup(createElement(Summary, { result }))
  const unknown = render({ rating: 0, sentiment: 'neutral', keywords: ['맛'] })
  assert.match(unknown, /별점 미입력/)
  assert.doesNotMatch(unknown, /중립/)
  assert.match(unknown, /리뷰 주제: 맛/)
  const known = render({ rating: 1, sentiment: 'negative', keywords: [] })
  assert.match(known, /고객 별점 1점/)
  assert.match(known, /별점 기준 부정/)
  assert.match(known, /확인된 주제 없음/)
})
