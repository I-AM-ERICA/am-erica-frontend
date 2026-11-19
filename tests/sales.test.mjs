import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
after(() => server.close())
const { validateSales, parseSalesForecast, predictSales, shiftDate } = await server.ssrLoadModule('/src/services/sales.ts')

test('one day and zero revenue are accepted; dates sorted without inventing missing data', () => {
  assert.deepEqual(validateSales([{ date: '2026-01-01', amount: '0' }]), [{ date: '2026-01-01', amount: 0 }])
  const rows = [{ date: '2026-01-02', amount: '9000' }, { date: '2026-01-01', amount: '12000' }]
  assert.equal(validateSales(rows)[0].amount, 12000)
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01')
  assert.equal(shiftDate('2028-02-28', 1), '2028-02-29')
})
test('invalid, missing, duplicate, future and fractional data cannot be submitted', () => {
  for (const amount of ['', '-1', 'NaN', '1.5', '1e3', '9007199254740992']) assert.throws(() => validateSales([{ date: '2026-01-01', amount }]))
  for (const date of ['', '2026-02-30', '2999-01-01']) assert.throws(() => validateSales([{ date, amount: '10' }]))
  assert.throws(() => validateSales([]))
  for (const date of ['2026-01-01', '2026-01-03']) assert.throws(() => validateSales([{ date: '2026-01-01', amount: '0' }, { date, amount: '1' }]))
})
const history = [{ date: '2026-01-01', amount: 500000 }]
const forecast = { historyDays: 1, model: 'chronos-t5-small', summary: '다음 날 예측', points: [{ date: '2026-01-02', predicted: 520000, lower: 400000, upper: 650000 }] }
test('rejects mocks, wrong dates, missing points, invalid ranges and history counts', () => {
  assert.equal(parseSalesForecast(forecast, history, 1).points[0].predicted, 520000)
  for (const data of [{ ...forecast, model: 'mock-weekday-average' }, { ...forecast, historyDays: 28 }, { ...forecast, points: [] },
    { ...forecast, points: [{ ...forecast.points[0], date: '2026-01-03' }] }, { ...forecast, points: [{ ...forecast.points[0], lower: 900000 }] },
    { ...forecast, points: [{ ...forecast.points[0], predicted: NaN }] }]) assert.throws(() => parseSalesForecast(data, history, 1))
})
test('prediction goes through the store backend with typed daily values, never CSV', async () => {
  const original = globalThis.fetch
  let sent
  globalThis.fetch = async (url, init) => { sent = { url, init }; return Response.json(forecast) }
  try {
    const result = await predictSales(history, 1, { id: 42 }, new AbortController().signal)
    assert.equal(result.model, 'chronos-t5-small')
    assert.equal(sent.url, '/api/stores/42/ai/management/forecast')
    assert.deepEqual(JSON.parse(sent.init.body), { history, horizonDays: 1 })
    globalThis.fetch = async () => new Response('{}', { status: 503 })
    await assert.rejects(predictSales(history, 1, { id: 42 }, new AbortController().signal), /연결하지/)
  } finally { globalThis.fetch = original }
})
test('sales screen offers daily input and horizon selection without file uploads', async () => {
  const { default: SalesPage } = await server.ssrLoadModule('/src/pages/SalesPage.tsx')
  const noop = () => {}
  const html = renderToStaticMarkup(createElement(SalesPage, { profile: { id: 42 }, onBack: noop, onSave: noop, onToast: noop }))
  assert.match(html, /type="date"/)
  assert.match(html, /일매출 \(원\)/)
  assert.match(html, /다음 날/)
  assert.match(html, /매출 예측하기/)
  assert.doesNotMatch(html, /type="file"/)
})
