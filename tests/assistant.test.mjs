import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
const { analyzeSalesCsv, runAssistant } = await server.ssrLoadModule('/src/services/assistant.ts')
after(() => server.close())

test('CSV computes totals, refunds, daily average and the highest sales hour', () => {
  const result = analyzeSalesCsv('날짜,시간,매출\n2026-11-01,10,10000\n2026-11-01,12,30000\n2026-11-02,12,20000\n2026-11-02,15,-5000')
  assert.match(result, /총매출: 55,000원/)
  assert.match(result, /내역 1건당 평균 매출: 13,750원/)
  assert.match(result, /일평균 매출: 27,500원/)
  assert.match(result, /매출이 가장 높은 시간: 12시 \(50,000원\)/)
  assert.match(result, /매출이 가장 높은 날: 2026-11-01 \(40,000원\)/)
})

test('CSV handles BOM, CRLF, quoted commas and escaped quotes', () => {
  const result = analyzeSalesCsv('\uFEFFdate,hour,amount,note\r\n2026-11-01,12:30,"15,000","a, b"\r\n2026-11-02,13,"25,000","say ""hello"""\r\n')
  assert.match(result, /총매출: 40,000원/)
  assert.match(result, /매출이 가장 높은 시간: 13시/)
})

test('CSV supports amount-only data and zero sales', () => {
  const result = analyzeSalesCsv('amount\n0\n0')
  assert.match(result, /총매출: 0원/)
  assert.match(result, /매출 내역: 2건/)
  assert.doesNotMatch(result, /NaN|Infinity/)
})

test('CSV rejects malformed or empty sales data instead of silently changing totals', () => {
  for (const input of ['', '매출', '날짜\n2026-11-01', '매출\nabc', '매출\n"100', '시간,매출\n24,100', '매출,메모\n,누락']) {
    assert.throws(() => analyzeSalesCsv(input), Error, input)
  }
})

test('all demo assistants return usable content and policy references', async () => {
  const profile = { name: '테스트 가게', owner: '사장', category: '카페', region: '서울' }
  for (const id of ['policy', 'marketing', 'customer', 'sales']) {
    const result = await runAssistant(id, { message: id === 'sales' ? '매출\n1000' : '신메뉴 소식', format: id === 'marketing' ? '카드뉴스 문안' : '리뷰 답글', profile })
    assert.ok(result.text.length > 50)
    if (id === 'policy') assert.ok(result.sources.every((source) => source.url.startsWith('https://')))
    if (id === 'marketing') assert.match(result.text, /테스트 가게/)
  }
})

test('dashboard, four assistant forms, history and settings render', async () => {
  const profile = { name: '테스트 가게', owner: '사장', category: '카페', region: '서울' }
  const noop = () => {}
  const [{ default: Dashboard }, { default: AssistantPage }, { default: HistoryPage }, { default: SettingsPage }] = await Promise.all([
    server.ssrLoadModule('/src/pages/Dashboard.tsx'),
    server.ssrLoadModule('/src/pages/AssistantPage.tsx'),
    server.ssrLoadModule('/src/pages/HistoryPage.tsx'),
    server.ssrLoadModule('/src/pages/SettingsPage.tsx'),
  ])
  assert.match(renderToStaticMarkup(createElement(Dashboard, { profile, activities: [], onNavigate: noop, onActivity: noop, onGuide: noop })), /어떤 도움이 필요하세요/)
  for (const id of ['policy', 'marketing', 'customer', 'sales']) {
    assert.match(renderToStaticMarkup(createElement(AssistantPage, { id, profile, onBack: noop, onSave: noop, onToast: noop })), /assistant-message/)
  }
  assert.match(renderToStaticMarkup(createElement(HistoryPage, { activities: [], onOpen: noop })), /해당하는 작업이 없어요/)
  assert.match(renderToStaticMarkup(createElement(SettingsPage, { profile, onSave: noop })), /테스트 가게/)
})

test('first visits show the introduction and protect unconfigured assistant routes', async () => {
  const { readRoute, resolveRoute } = await server.ssrLoadModule('/src/services/navigation.ts')
  assert.equal(readRoute(''), 'intro')
  assert.equal(readRoute('#unknown'), 'intro')
  assert.equal(resolveRoute(readRoute('#dashboard'), false), 'setup')
  assert.equal(resolveRoute(readRoute('#policy'), false), 'setup')
  assert.equal(resolveRoute(readRoute('#dashboard'), true), 'dashboard')
  assert.equal(resolveRoute(readRoute('#setup'), true), 'setup')
  assert.equal(resolveRoute(readRoute('#intro'), true), 'intro')
})

test('introduction offers a start action and industry selection requires a choice', async () => {
  const [{ default: LandingPage }, { default: BusinessSetupPage }] = await Promise.all([
    server.ssrLoadModule('/src/pages/LandingPage.tsx'),
    server.ssrLoadModule('/src/pages/BusinessSetupPage.tsx'),
  ])
  const noop = () => {}
  const profile = { name: '우리 가게', owner: '사장', category: '음식점', region: '서울' }
  const firstVisit = renderToStaticMarkup(createElement(LandingPage, { hasStore: false, onStart: noop, onResume: noop }))
  assert.match(firstVisit, /우리 가게 비서 시작하기/)
  const setup = renderToStaticMarkup(createElement(BusinessSetupPage, { profile, hasStore: false, onBack: noop, onComplete: noop }))
  assert.equal((setup.match(/type="radio"/g) ?? []).length, 8)
  assert.match(setup, /type="submit" disabled=""/)
  const returningSetup = renderToStaticMarkup(createElement(BusinessSetupPage, { profile, hasStore: true, onBack: noop, onComplete: noop }))
  assert.doesNotMatch(returningSetup, /type="submit" disabled=""/)
  assert.match(returningSetup, /checked="" value="음식점"|value="음식점" checked=""/)
})
