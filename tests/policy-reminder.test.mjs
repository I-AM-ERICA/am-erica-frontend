import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
after(() => server.close())
const originalFetch = globalThis.fetch
const originalStorage = globalThis.localStorage
const originalWindow = globalThis.window
globalThis.window = new EventTarget()
const saved = new Map()
globalThis.localStorage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: (key) => saved.delete(key) }
afterEach(() => { globalThis.fetch = originalFetch; saved.clear() })
after(() => { globalThis.localStorage = originalStorage; globalThis.window = originalWindow })
const { getPolicyReminder, setPolicyReminder, sendPolicyDigest } = await server.ssrLoadModule('/src/services/policy-reminder.ts')
const response = { enabled: false, email: 'owner@example.com', storeId: null, storeName: null, deliveryConfigured: false, manualDeliveryConfigured: true, lastSentDate: null }
const profile = { name: '가게', category: '카페', region: '서울' }

test('reading and disabling reminders never creates a store or sends a mail', async () => {
  const calls = []
  globalThis.fetch = async (url, init) => { calls.push([url, init]); return Response.json(response) }
  assert.equal((await getPolicyReminder(new AbortController().signal)).enabled, false)
  await setPolicyReminder(false, profile, new AbortController().signal)
  assert.equal(calls.length, 2)
  assert.equal(calls[0][0], '/api/me/policy-reminder')
  assert.equal(calls[1][1].method, 'PUT')
  assert.deepEqual(JSON.parse(calls[1][1].body), { enabled: false })
})

test('enabling uses the matching account store and waits for a confirmed backend result', async () => {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push([url, init])
    if (url === '/api/stores') return Response.json([{ id: 4, name: '다른 가게' }, { id: 7, ...profile }])
    return Response.json({ ...response, enabled: true, storeId: 7, storeName: profile.name })
  }
  const result = await setPolicyReminder(true, profile, new AbortController().signal)
  assert.equal(result.enabled, true)
  assert.deepEqual(JSON.parse(calls[1][1].body), { enabled: true, storeId: 7 })
})

test('backend failures and malformed settings cannot masquerade as a saved preference', async () => {
  globalThis.fetch = async () => Response.json({ code: 'EMAIL_REQUIRED' }, { status: 400 })
  await assert.rejects(getPolicyReminder(new AbortController().signal), /이메일 제공/)
  globalThis.fetch = async () => Response.json({ enabled: true })
  await assert.rejects(getPolicyReminder(new AbortController().signal), /응답/)
  globalThis.fetch = async () => new Response(null, { status: 401 })
  await assert.rejects(getPolicyReminder(new AbortController().signal), /로그인이 만료/)
})

test('policy page reminder control is an accessible switch and disabled while loading', async () => {
  const { default: Toggle } = await server.ssrLoadModule('/src/components/PolicyReminderToggle.tsx')
  const html = renderToStaticMarkup(createElement(Toggle, { profile }))
  assert.match(html, /오전 6시 이메일 알림/)
  assert.match(html, /보냈던 내용도 매일/)
  assert.match(html, /role="switch" aria-checked="false"[^>]*disabled=""/)
  assert.match(html, /한국 시간/)
  assert.match(html, /정책 검색 후 이메일로 받기/)
})

test('manual policy email uses the persisted store and lets the server select the recipient', async () => {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push([url, init])
    return Response.json({ email: 'owner@example.com', content: '현재 정책 검색 결과와 공식 출처' })
  }
  const result = await sendPolicyDigest({ ...profile, id: 7 }, new AbortController().signal)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], '/api/me/policy-reminder/send-now')
  assert.equal(calls[0][1].method, 'POST')
  assert.deepEqual(JSON.parse(calls[0][1].body), { storeId: 7 })
  assert.equal(result.content, '현재 정책 검색 결과와 공식 출처')
})

test('manual delivery never retries or treats failed and malformed responses as success', async () => {
  let count = 0
  globalThis.fetch = async () => { count++; return Response.json({ code: 'AI_UNAVAILABLE' }, { status: 503 }) }
  await assert.rejects(sendPolicyDigest({ ...profile, id: 7 }, new AbortController().signal), /메일을 보내지 않았어요/)
  assert.equal(count, 1)
  for (const code of ['AI_SEARCH_LIMIT', 'AI_NO_SOURCES', 'AI_MODEL_REQUIRED', 'AI_ERROR']) {
    globalThis.fetch = async () => Response.json({ code }, { status: 502 })
    await assert.rejects(sendPolicyDigest({ ...profile, id: 7 }, new AbortController().signal), /메일|모델/)
  }
  globalThis.fetch = async () => Response.json({ code: 'MAIL_SEND_FAILED' }, { status: 502 })
  await assert.rejects(sendPolicyDigest({ ...profile, id: 7 }, new AbortController().signal), /받은메일함/)
  globalThis.fetch = async () => Response.json({ email: 'owner@example.com', content: '' })
  await assert.rejects(sendPolicyDigest({ ...profile, id: 7 }, new AbortController().signal), /받은메일함/)
  globalThis.fetch = async () => new Response(null, { status: 401 })
  await assert.rejects(sendPolicyDigest({ ...profile, id: 7 }, new AbortController().signal), /로그인이 만료/)
})
