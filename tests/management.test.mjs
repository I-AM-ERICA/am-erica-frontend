import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
after(() => server.close())
const { emptyPlan, payroll, validateShift, parsePlan, managementKey, revenueEstimate, amount, validDate } = await server.ssrLoadModule('/src/services/management.ts')
const employee = { id: 'staff-1', name: '김민수', role: '홀', contact: '', hourlyWage: 12000 }
const shift = { id: 'shift-1', employeeId: 'staff-1', date: '2026-11-22', start: '09:00', end: '18:00', breakMinutes: 60 }
const plan = () => ({ ...emptyPlan(), employees: [employee], shifts: [shift] })
test('payroll subtracts unpaid breaks, scopes the month, and rounds only the employee total', () => {
  const data = plan(); data.shifts.push({ ...shift, id: '2', date: '2026-12-01' }, { ...shift, id: '3', date: '2026-11-23', end: '09:01', breakMinutes: 0 })
  assert.equal(payroll(data, '2026-11')[0].minutes, 481)
  assert.equal(payroll(data, '2026-11')[0].pay, 96200)
  assert.equal(payroll(data, '2026-12')[0].pay, 96000)
  assert.equal(payroll(data, '2027-01')[0].pay, 0)
})
test('invalid dates, overlaps, missing employees and invalid breaks cannot enter a shift', () => {
  for (const change of [{ date: '2026-02-30' }, { date: '2026-13-01' }, { employeeId: 'missing' }, { start: '19:00' }, { end: '25:00' }, { breakMinutes: -1 }, { breakMinutes: 540 }, { breakMinutes: 1.5 }]) assert.throws(() => validateShift({ ...shift, ...change }, plan()))
  assert.throws(() => validateShift({ ...shift, id: 'other', start: '17:00', end: '19:00' }, plan()), /겹쳐/)
  assert.doesNotThrow(() => validateShift({ ...shift, id: 'other', start: '18:00', end: '19:00', breakMinutes: 0 }, plan()))
  assert.doesNotThrow(() => validateShift({ ...shift, end: '17:00' }, plan()))
  assert.equal(validDate('2028-02-29'), true)
  assert.equal(validDate('2026-02-29'), false)
})
test('storage is isolated per user and store; corrupted and orphaned records are rejected', () => {
  assert.notEqual(managementKey(1, 2), managementKey(2, 2)); assert.notEqual(managementKey(1, 2), managementKey(1, 3))
  assert.deepEqual(parsePlan(JSON.stringify(plan())), plan())
  for (const data of [null, {}, { ...plan(), employees: [] }, { ...plan(), shifts: [shift, shift] }, { ...plan(), employees: [employee, employee] }, { ...plan(), budgets: { '2026-11': { rent: -1, costs: [] } } }, { ...plan(), budgets: { '2026-11': { rent: 0, costs: [{ id: 'c', name: '', amount: 20 }] } } }]) assert.throws(() => parsePlan(JSON.stringify(data)))
  assert.throws(() => parsePlan('bad-json'))
})
test('monthly reference estimates use only selected-month predictions and actual calendar length', () => {
  const forecast = { points: [{ date: '2028-02-28', predicted: 100 }, { date: '2028-02-29', predicted: 200 }, { date: '2028-03-01', predicted: 9000 }] }
  assert.deepEqual(revenueEstimate(forecast, '2028-02'), { amount: 4350, sampleDays: 2, days: 29 })
  assert.equal(revenueEstimate(forecast, '2028-04'), null)
  assert.equal(revenueEstimate(null, '2028-02'), null)
  for (const value of ['-1', '1.5', '1e3', '', '1000000001']) assert.throws(() => amount(value))
  assert.equal(amount('0'), 0)
})
