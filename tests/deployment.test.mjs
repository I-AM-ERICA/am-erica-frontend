import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

test('static deployment sends authenticated requests to the configured backend and preserves cancellation', async (t) => {
  const server = await createServer({ configFile: false, envFile: false,
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://api.example.com/') },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { apiFetch } = await server.ssrLoadModule('/src/services/api.ts')
    const signal = new AbortController().signal
    const init = { method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: '{}', signal }
    const response = new Response('{}')
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, 'https://api.example.com/api/me/settings')
      assert.equal(options, init)
      return response
    })
    assert.equal(await apiFetch('/api/me/settings', init), response)
  } finally { t.mock.restoreAll(); await server.close() }
})

test('Pages login returns to the project root without losing its subpath', async (t) => {
  const server = await createServer({ configFile: false, envFile: false,
    define: {
      'import.meta.env.PROD': 'true',
      'import.meta.env.BASE_URL': JSON.stringify('/am-erica-frontend/'),
      'import.meta.env.VITE_NAVER_CLIENT_ID': JSON.stringify('public-client-id'),
      'import.meta.env.VITE_NAVER_REDIRECT_URI': JSON.stringify(''),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://api.example.com'),
    }, server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  const originalWindow = globalThis.window
  const originalStorage = globalThis.sessionStorage
  const origin = 'https://i-am-erica.github.io'
  const pathname = '/am-erica-frontend/'
  const storage = new Map()
  let assigned, cleaned
  globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) }
  globalThis.window = { location: { origin, pathname, href: origin + pathname, search: '', assign: (url) => { assigned = new URL(url) } },
    history: { replaceState: (_state, _title, url) => { cleaned = String(url) } }, dispatchEvent() {} }
  try {
    const auth = await server.ssrLoadModule('/src/services/auth.ts')
    auth.startNaverLogin('policy')
    assert.equal(assigned.searchParams.get('redirect_uri'), origin + pathname)
    const state = assigned.searchParams.get('state')
    window.location.search = `?code=one-use-code&state=${state}`
    window.location.href += window.location.search
    const calls = []
    t.mock.method(globalThis, 'fetch', async (url) => {
      calls.push(url)
      return Response.json(url.endsWith('/auth/naver')
        ? { accessToken: 'service-token', tokenType: 'Bearer', expiresIn: 3600 }
        : { id: 1, name: '사장', email: 'owner@example.com' })
    })
    const result = await auth.initializeAuth()
    assert.equal(result.user.id, 1)
    assert.equal(result.returnTo, 'policy')
    assert.equal(cleaned, origin + pathname + '#login')
    assert.deepEqual(calls, ['https://api.example.com/api/auth/naver', 'https://api.example.com/api/users/me'])
    assert.equal(storage.has('gage-naver-attempt'), false)
  } finally {
    globalThis.window = originalWindow
    globalThis.sessionStorage = originalStorage
    t.mock.restoreAll()
    await server.close()
  }
})
