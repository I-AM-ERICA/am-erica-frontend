// Real frontend service -> Vite proxy -> authenticated Spring -> Python gRPC -> SerpAPI.
// Creates test accounts in the local backend. Does not send mail or save login tokens.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { createServer } from 'vite'

const base = process.env.POLICY_APP_URL || 'http://127.0.0.1:7001'
const nativeFetch = globalThis.fetch
globalThis.fetch = (input, init) => nativeFetch(typeof input === 'string' ? new URL(input, base) : input, init)
const values = new Map()
globalThis.sessionStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
}
globalThis.window = { location: new URL(base), dispatchEvent() {} }

async function signup() {
  const response = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${randomUUID()}@integration.invalid`, password: randomUUID(), name: '연동 테스트' }) })
  assert.equal(response.status, 201, 'Local test signup must succeed')
  return response.json()
}

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
try {
  assert.equal((await fetch('/')).status, 200)
  const session = await signup()
  sessionStorage.setItem('gage-auth-session', JSON.stringify({ accessToken: session.accessToken,
    expiresAt: Date.now() + session.expiresIn * 1000 }))
  const auth = await server.ssrLoadModule('/src/services/auth.ts')
  assert.ok((await auth.initializeAuth()).user?.id, 'Existing frontend auth must restore the real JWT')
  const { askPolicy } = await server.ssrLoadModule('/src/services/policy-chat.ts')
  let updates = 0
  const question = '2026년 서울시 중소기업육성자금 융자지원 계획의 대상과 신청 기간, 신청 방법을 공식 공고로 확인해줘.'
  const answer = await askPolicy(question, [], { name: '정책 연동 테스트 매장', category: '음식점', region: '서울', owner: '테스트' },
    () => { updates++ }, AbortSignal.timeout(120000))
  assert.ok(answer.text.includes('지원 대상') && answer.text.includes('신청 절차'))
  assert.ok(!answer.text.includes('[MOCK]'))
  assert.ok(answer.sources.some(source => new URL(source.url).hostname.endsWith('.go.kr')))
  assert.ok(updates > 0, 'Real SSE must be parsed by the frontend service')
  const headers = { ...auth.getAuthHeaders(), 'Content-Type': 'application/json' }
  const stores = await (await fetch('/api/stores', { headers })).json()
  const store = stores.find(x => x.name === '정책 연동 테스트 매장')
  assert.ok(store?.id)
  const endpoint = `/api/stores/${store.id}/ai/policy/stream`
  const unauthenticated = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) })
  assert.equal(unauthenticated.status, 401)
  const invalidTopK = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ question, topK: 6 }) })
  assert.equal(invalidTopK.status, 400)
  const other = await signup()
  const unauthorized = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${other.accessToken}` }, body: JSON.stringify({ question }) })
  assert.ok([403, 404].includes(unauthorized.status), 'Another account must not access this store')
  const report = { status: 'passed', question, answer: answer.text, sources: answer.sources, sseUpdates: updates,
    checks: { frontendAuthentication: true, storeCreation: true, realPolicyAnswer: true, sourceUrls: true,
      unauthenticatedRejected: true, otherAccountRejected: true, invalidTopKRejected: true },
    note: 'Uses local test signup to verify JWT/session handling; live Naver OAuth login is not tested.' }
  if (process.env.POLICY_SMOKE_OUTPUT) await writeFile(process.env.POLICY_SMOKE_OUTPUT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ status: report.status, sseUpdates: updates, sourceUrls: answer.sources.map(s => s.url), checks: report.checks }, null, 2))
} finally {
  values.clear()
  await server.close()
}
