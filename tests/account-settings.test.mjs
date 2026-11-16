import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
after(() => server.close())
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const originalStorage = globalThis.localStorage
globalThis.window = new EventTarget()
globalThis.localStorage = { getItem() { throw new Error('Account settings must come from backend') }, setItem() { throw new Error('Account settings must persist on backend') } }
afterEach(() => { globalThis.fetch = originalFetch })
after(() => { globalThis.window = originalWindow; globalThis.localStorage = originalStorage })
const { loadAccountSettings, saveStoreProfile, saveStaffPreference } = await server.ssrLoadModule('/src/services/account-settings.ts')
const { resolveStore } = await server.ssrLoadModule('/src/services/policy-chat.ts')
const preferences = { policy: 'boy', marketing: 'girl', customer: 'girl', sales: 'boy' }
const profile = { id: 17, name: '오후의 커피', owner: '김사장', category: '카페', region: '지역 미설정' }
const data = { store: profile, staffPreferences: preferences }
const signal = () => new AbortController().signal

test('saved store and staff choices restore entirely from account API without browser storage', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/me/settings'); assert.equal(init.method, 'GET'); assert.equal(init.cache, 'no-store')
    return Response.json({ ...data, staffPreferences: { ...preferences, policy: 'girl' } })
  }
  const saved = await loadAccountSettings(signal())
  assert.equal(saved.store.id, 17); assert.equal(saved.staffPreferences.policy, 'girl')
  globalThis.fetch = async () => Response.json({ store: null, staffPreferences: preferences })
  assert.equal((await loadAccountSettings(signal())).store, null)
})

test('profile save excludes client IDs and gender updates only send the selected assistant choice', async () => {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push([url, init])
    return Response.json(init.method === 'PUT' ? data : { ...preferences, customer: 'boy' })
  }
  await saveStoreProfile({ ...profile, name: ' 오후의 커피 ' }, signal())
  assert.equal(calls[0][0], '/api/me/store-profile')
  assert.deepEqual(JSON.parse(calls[0][1].body), { name: profile.name, owner: profile.owner, category: profile.category, region: profile.region })
  const result = await saveStaffPreference('customer', 'boy', signal())
  assert.equal(calls[1][0], '/api/me/staff-preferences/customer')
  assert.deepEqual(JSON.parse(calls[1][1].body), { gender: 'boy' })
  assert.equal(result.customer, 'boy')
})

test('server and authentication failures never become empty new-account settings', async () => {
  for (const status of [401, 500]) {
    globalThis.fetch = async () => new Response(null, { status })
    await assert.rejects(loadAccountSettings(signal()))
    await assert.rejects(saveStaffPreference('policy', 'girl', signal()))
  }
  for (const invalid of [{}, { store: null, staffPreferences: {} }, { ...data, store: { ...profile, id: -1 } }]) {
    globalThis.fetch = async () => Response.json(invalid)
    await assert.rejects(loadAccountSettings(signal()))
  }
  globalThis.fetch = async () => Response.json({ store: null, staffPreferences: preferences })
  await assert.rejects(saveStoreProfile(profile, signal()), /저장 결과/)
})

test('a restored store ID remains stable after name changes and avoids duplicate registration', async () => {
  globalThis.fetch = async () => { throw new Error('Should reuse the authenticated account store ID') }
  assert.equal(await resolveStore({ ...profile, name: '새 이름' }, signal()), profile.id)
})

test('setup and settings explain account persistence and staff buttons disable during saves', async () => {
  const { default: Setup } = await server.ssrLoadModule('/src/pages/BusinessSetupPage.tsx')
  const { default: Settings } = await server.ssrLoadModule('/src/pages/SettingsPage.tsx')
  const { default: Dashboard } = await server.ssrLoadModule('/src/pages/Dashboard.tsx')
  const noop = () => {}
  const setup = renderToStaticMarkup(createElement(Setup, { profile, hasStore: false, onBack: noop, onComplete: noop }))
  assert.match(setup, /계정에 저장/); assert.doesNotMatch(setup, /이 브라우저에 저장/)
  const settings = renderToStaticMarkup(createElement(Settings, { profile, onSave: noop }))
  assert.match(settings, /다른 기기에서도/); assert.doesNotMatch(settings, /가게 소재지/)
  const dashboard = renderToStaticMarkup(createElement(Dashboard, { profile, activities: [], onNavigate: noop, onActivity: noop, onGuide: noop, onStaffGenderChange: noop, staffSaving: true }))
  assert.equal((dashboard.match(/disabled="" aria-pressed=/g) || []).length, 8)
})
