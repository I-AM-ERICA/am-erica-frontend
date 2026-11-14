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
const { getPolicyReminder, setPolicyReminder } = await server.ssrLoadModule('/src/services/policy-reminder.ts')
const response = { enabled: false, email: 'owner@example.com', storeId: null, storeName: null, deliveryConfigured: false, lastSentDate: null }
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
})
