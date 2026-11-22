import { CalendarDays, Download, Mail, Pencil, Plus, Save, Trash2, Users, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthUser } from '../services/auth'
import type { SalesForecast } from '../services/sales'
import { todayInSeoul } from '../services/sales'
import { amount, emptyPlan, managementKey, money, parsePlan, payroll, revenueEstimate, shiftMinutes, validateShift } from '../services/management'
import type { Employee, ManagementPlan, Shift } from '../services/management'
import { loadManagement, saveManagement } from '../services/managementApi'
import type { ManagementSnapshot } from '../services/managementApi'
import '../pages/styles/management.css'

interface Props { user?: AuthUser | null; storeId?: number; storeName: string; forecast: SalesForecast | null; onToast: (message: string) => void; onForecast: () => void }
const blankEmployee = { id: '', name: '', role: '', contact: '', hourlyWage: '' }
const hours = (value: number) => `${Math.floor(value / 60)}시간${value % 60 ? ` ${value % 60}분` : ''}`
export default function ManagementPlanner({ user, storeId, storeName, forecast, onToast, onForecast }: Props) {
  const key = user?.id && storeId ? managementKey(user.id, storeId) : null
  const [plan, setPlan] = useState(emptyPlan)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [meta, setMeta] = useState<ManagementSnapshot | null>(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  const savingRequest = useRef<AbortController | null>(null)
  useEffect(() => () => savingRequest.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    const timer = window.setTimeout(() => controller.abort(), 20000)
    setReady(false); setError('')
    if (!storeId || !key) { setError('로그인 후 가게 정보를 먼저 저장해 주세요.'); window.clearTimeout(timer); return }
    loadManagement(storeId, controller.signal).then(data => {
      if (controller.signal.aborted) return
      setMeta(data); setPlan(data.plan); setDirty(false)
      // Import the old browser-only draft once. Email consent must be saved explicitly.
      if (data.revision === 0) {
        try {
          const raw = localStorage.getItem(key)
          if (raw) { setPlan({ ...parsePlan(raw), emailRequested: false }); setDirty(true); setError('이 기기의 기존 경영 정보를 가져왔어요. 저장을 눌러 계정에 보관해 주세요.') }
        } catch { setError('이 기기의 이전 경영 정보를 읽지 못했어요. 서버 정보는 정상적으로 불러왔습니다.') }
      }
      setReady(true)
    }).catch(cause => { if (disposed) return; setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : '경영 정보를 불러오는 시간이 초과됐어요. 다시 시도해 주세요.') })
      .finally(() => window.clearTimeout(timer))
    return () => { disposed = true; window.clearTimeout(timer); controller.abort() }
  }, [storeId, key, reload])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const [month, setMonth] = useState(todayInSeoul().slice(0, 7))
  const [tab, setTab] = useState<'staff' | 'budget' | 'report'>('staff')
  const [employee, setEmployee] = useState(blankEmployee)
  const [shift, setShift] = useState({ id: '', employeeId: '', date: todayInSeoul(), start: '09:00', end: '18:00', breakMinutes: '60' })
  const [cost, setCost] = useState({ name: '', amount: '' })
  const previousMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 2, 1)).toISOString().slice(0, 7)
  const budget = plan.budgets[month] ?? { rent: 0, costs: [] }
  const salaries = payroll(plan, month)
  const salaryTotal = salaries.reduce((sum, item) => sum + item.pay, 0)
  const fixedTotal = budget.costs.reduce((sum, item) => sum + item.amount, 0)
  const total = salaryTotal + budget.rent + fixedTotal
  const estimate = revenueEstimate(forecast, month)
  const shifts = plan.shifts.filter((item) => item.date.startsWith(`${month}-`)).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
  const change = (next: ManagementPlan) => { setPlan(next); setDirty(true); setError('') }
  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : '입력 내용을 확인해 주세요.')
  const persist = async () => {
    if (!storeId || !meta || !ready || savingRequest.current) return
    const controller = new AbortController(); savingRequest.current = controller
    const timer = window.setTimeout(() => controller.abort(), 20000)
    setSaving(true); setError('')
    try {
      const data = await saveManagement(storeId, meta.revision, plan, controller.signal)
      if (controller.signal.aborted) return
      setMeta(data); setPlan(data.plan); setDirty(false)
      try { if (key) localStorage.removeItem(key) } catch { /* Server save succeeded. */ }
      onToast('가게의 경영 정보를 저장했어요.')
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : '저장 결과를 확인하지 못했어요. 입력을 보관한 뒤 새로고침해 주세요.')
    } finally { window.clearTimeout(timer); savingRequest.current = null; setSaving(false) }
  }
  const saveEmployee = (event: FormEvent) => {
    event.preventDefault()
    try {
      if (!employee.name.trim()) throw new Error('직원 이름을 입력해 주세요.')
      if (!employee.id && plan.employees.length >= 100) throw new Error('직원은 최대 100명까지 등록할 수 있어요.')
      const item: Employee = { ...employee, name: employee.name.trim(), hourlyWage: amount(employee.hourlyWage), id: employee.id || crypto.randomUUID() }
      change({ ...plan, employees: employee.id ? plan.employees.map((e) => e.id === item.id ? item : e) : [...plan.employees, item] }); setEmployee(blankEmployee)
    } catch (cause) { fail(cause) }
  }
  const saveShift = (event: FormEvent) => {
    event.preventDefault()
    try {
      if (!shift.id && plan.shifts.length >= 10000) throw new Error('근무 일정은 최대 10,000건까지 저장할 수 있어요.')
      if (!/^\d+$/.test(shift.breakMinutes)) throw new Error('휴게시간을 분 단위 정수로 입력해 주세요.')
      const item: Shift = { ...shift, id: shift.id || crypto.randomUUID(), breakMinutes: Number(shift.breakMinutes) }
      validateShift(item, plan)
      change({ ...plan, shifts: shift.id ? plan.shifts.map((s) => s.id === item.id ? item : s) : [...plan.shifts, item] }); setMonth(item.date.slice(0, 7)); setShift({ ...shift, id: '' })
    } catch (cause) { fail(cause) }
  }
  const report = [`${storeName} · ${month} 경영 보고서`, '', `예상 기본급 합계: ${money(salaryTotal)}`, ...salaries.map((s) => `- ${s.name}: ${hours(s.minutes)}, ${money(s.pay)}`), `월세: ${money(budget.rent)}`, ...budget.costs.map((c) => `${c.name}: ${money(c.amount)}`), `입력한 비용 합계: ${money(total)}`, '', `월 매출 참고 추정: ${estimate ? money(estimate.amount) : '예측 자료 없음'}`, estimate ? `산식: ${month}의 Chronos 예측 ${estimate.sampleDays}일 평균 × ${estimate.days}일. 월 전체를 직접 예측한 결과가 아닙니다.` : '매출 예측 탭에서 선택한 달의 예측을 먼저 실행해 주세요.', '급여는 입력한 일정과 현재 시급 기준이며 추가수당·공제는 포함하지 않습니다.', '', '메일 발송 일정: 매월 1일 낮 12시 (한국시간)', '메일은 서버에 저장한 일정·고정비와 전월 말일까지의 매출을 기준으로 작성됩니다.'].join('\n')
  const download = () => {
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `management-${month}.txt`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="management-planner" aria-label="직원과 월간 경영 관리">
    <div className="management-toolbar"><div><h2>이번 달 운영 계획</h2><p>직원 일정부터 고정비까지, 한곳에서 관리하세요.</p></div><label>기준 월<input aria-label="관리 기준 월" type="month" min="2000-01" max="2099-12" value={month} onChange={(e) => { if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value) }} /></label></div>
    <div className="management-stats"><div><span>예상 알바 기본급</span><strong>{money(salaryTotal)}</strong><small>{plan.employees.length}명 · 근무 {shifts.length}건</small></div><div><span>월세 · 추가 고정비</span><strong>{money(budget.rent + fixedTotal)}</strong><small>{month} 입력 기준</small></div><div><span>월 매출 참고 추정</span><strong>{estimate ? money(estimate.amount) : '예측 전'}</strong><small>{estimate ? `예측 ${estimate.sampleDays}일 평균 × ${estimate.days}일` : '선택한 달의 매출 예측 필요'}</small></div></div>
    <div className="management-tabs" role="group" aria-label="운영 계획 메뉴">{([['staff', Users, '직원 · 근무표'], ['budget', Wallet, '월세 · 고정비'], ['report', Mail, '월간 보고서']] as const).map(([id, Icon, title]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setError('') }}><Icon size={17} />{title}</button>)}</div>
    {error && <p className="sales-error" role="alert">{error}</p>}
    {!ready && <button type="button" className="sales-add" onClick={() => setReload(n => n + 1)}>경영 정보 다시 불러오기</button>}
    <fieldset className="management-fields" disabled={!ready || saving}>
    {tab === 'staff' && <div className="management-columns">
      <section className="sales-panel"><div className="sales-section-title"><h3>우리 가게 직원</h3><span>{plan.employees.length}명</span></div>
        <div className="management-roster">{!plan.employees.length && <p className="management-empty">첫 직원을 등록하고 근무표를 채워 보세요.</p>}{plan.employees.map((item) => <article key={item.id}><div><strong>{item.name}</strong><p>{item.role || '담당 업무 미입력'} · 시급 {money(item.hourlyWage)}</p>{item.contact && <small>{item.contact}</small>}</div><button type="button" aria-label={`${item.name} 직원 수정`} onClick={() => setEmployee({ ...item, hourlyWage: String(item.hourlyWage) })}><Pencil size={16} /></button><button type="button" aria-label={`${item.name} 직원 삭제`} onClick={() => { if (window.confirm(`${item.name} 직원과 해당 직원의 모든 근무 일정을 삭제할까요?`)) { change({ ...plan, employees: plan.employees.filter((e) => e.id !== item.id), shifts: plan.shifts.filter((s) => s.employeeId !== item.id) }); if (employee.id === item.id) setEmployee(blankEmployee); if (shift.employeeId === item.id) setShift({ ...shift, id: '', employeeId: '' }) } }}><Trash2 size={16} /></button></article>)}</div>
        <form className="management-form" onSubmit={saveEmployee}><h4>{employee.id ? '직원 정보 수정' : '직원 추가'}</h4><label>이름<input required maxLength={40} value={employee.name} onChange={(e) => setEmployee({ ...employee, name: e.target.value })} placeholder="예: 김민수" /></label><div className="management-pair"><label>담당 업무 (선택)<input maxLength={60} value={employee.role} onChange={(e) => setEmployee({ ...employee, role: e.target.value })} placeholder="홀 / 주방" /></label><label>시급 (원)<input required inputMode="numeric" pattern="[0-9]+" maxLength={10} value={employee.hourlyWage} onChange={(e) => setEmployee({ ...employee, hourlyWage: e.target.value })} placeholder="예: 12000" /></label></div><label>연락처 (선택)<input maxLength={80} value={employee.contact} onChange={(e) => setEmployee({ ...employee, contact: e.target.value })} placeholder="연락 가능한 전화번호 또는 메모" /></label><button className="management-primary" type="submit"><Plus size={16} />{employee.id ? '직원 수정 완료' : '직원 명단에 추가'}</button>{employee.id && <button type="button" onClick={() => setEmployee(blankEmployee)}>수정 취소</button>}<p className="sales-help">시급을 변경하면 저장된 모든 일정의 예상 기본급도 다시 계산됩니다.</p></form>
      </section>
      <section className="sales-panel"><div className="sales-section-title"><h3><CalendarDays size={18} /> 근무 시간표</h3><span>{month}</span></div>
        <form className="management-form" onSubmit={saveShift}><div className="management-pair"><label>직원<select required value={shift.employeeId} onChange={(e) => setShift({ ...shift, employeeId: e.target.value })}><option value="">직원 선택</option>{plan.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>근무 날짜<input type="date" required min="2000-01-01" max="2099-12-31" value={shift.date} onChange={(e) => setShift({ ...shift, date: e.target.value })} /></label></div><div className="management-pair"><label>출근 시간<input type="time" required value={shift.start} onChange={(e) => setShift({ ...shift, start: e.target.value })} /></label><label>퇴근 시간<input type="time" required value={shift.end} onChange={(e) => setShift({ ...shift, end: e.target.value })} /></label></div><label>무급 휴게시간 (분)<input required inputMode="numeric" pattern="[0-9]+" maxLength={4} value={shift.breakMinutes} onChange={(e) => setShift({ ...shift, breakMinutes: e.target.value })} /></label><button className="management-primary" disabled={!plan.employees.length} type="submit"><Plus size={16} />{shift.id ? '근무 수정 완료' : '근무 일정 추가'}</button>{shift.id && <button type="button" onClick={() => setShift({ ...shift, id: '' })}>근무 수정 취소</button>}</form>
        <p className="sales-help">자정을 넘는 근무는 날짜별로 나누어 입력해 주세요.</p>
        <div className="management-shifts">{!shifts.length && <p className="management-empty">이 달에 등록한 근무 일정이 없어요.</p>}{shifts.map((item) => <article key={item.id}><div><strong>{item.date.slice(5).replace('-', '/')} · {plan.employees.find((e) => e.id === item.employeeId)?.name}</strong><p>{item.start}–{item.end} · {hours(shiftMinutes(item))}</p><small>무급 휴게 {item.breakMinutes}분</small></div><button type="button" aria-label={`${item.date} 근무 수정`} onClick={() => setShift({ ...item, breakMinutes: String(item.breakMinutes) })}><Pencil size={16} /></button><button type="button" aria-label={`${item.date} 근무 삭제`} onClick={() => { change({ ...plan, shifts: plan.shifts.filter((s) => s.id !== item.id) }); if (shift.id === item.id) setShift({ ...shift, id: '' }) }}><Trash2 size={16} /></button></article>)}</div>
      </section>
    </div>}
    {tab === 'budget' && <div className="management-columns"><section className="sales-panel management-form"><h3>{month} 고정비</h3><p className="sales-help">금액은 기준 월별로 저장됩니다. 반복되는 비용은 지난달에서 가져올 수 있어요.</p><button type="button" className="sales-add" disabled={!plan.budgets[previousMonth]} onClick={() => { if (window.confirm(`${previousMonth} 고정비로 ${month}의 월세와 추가 지출을 덮어쓸까요?`)) change({ ...plan, budgets: { ...plan.budgets, [month]: { rent: plan.budgets[previousMonth].rent, costs: plan.budgets[previousMonth].costs.map((c) => ({ ...c, id: crypto.randomUUID() })) } } }) }}>지난달 고정비 가져오기</button><label>월세 (원)<input inputMode="numeric" pattern="[0-9]+" maxLength={10} value={budget.rent} onChange={(e) => { try { const rent = amount(e.target.value || '0'); change({ ...plan, budgets: { ...plan.budgets, [month]: { ...budget, rent } } }) } catch (cause) { fail(cause) } }} /></label><h4>추가 고정 지출</h4>{budget.costs.map((item) => <div className="management-cost" key={item.id}><span>{item.name}</span><strong>{money(item.amount)}</strong><button type="button" aria-label={`${item.name} 고정비 삭제`} onClick={() => change({ ...plan, budgets: { ...plan.budgets, [month]: { ...budget, costs: budget.costs.filter((c) => c.id !== item.id) } } })}><Trash2 size={16} /></button></div>)}<form className="management-form" onSubmit={(e) => { e.preventDefault(); try { if (!cost.name.trim()) throw new Error('지출 항목 이름을 입력해 주세요.'); if (budget.costs.length >= 100) throw new Error('고정 지출은 최대 100개까지 등록할 수 있어요.'); const item = { id: crypto.randomUUID(), name: cost.name.trim(), amount: amount(cost.amount) }; change({ ...plan, budgets: { ...plan.budgets, [month]: { ...budget, costs: [...budget.costs, item] } } }); setCost({ name: '', amount: '' }) } catch (cause) { fail(cause) } }}><div className="management-pair"><label>지출 항목<input required maxLength={60} placeholder="예: 인터넷, 정수기 렌탈" value={cost.name} onChange={(e) => setCost({ ...cost, name: e.target.value })} /></label><label>월 금액 (원)<input required inputMode="numeric" pattern="[0-9]+" maxLength={10} placeholder="예: 35000" value={cost.amount} onChange={(e) => setCost({ ...cost, amount: e.target.value })} /></label></div><button className="sales-add" type="submit"><Plus size={18} />고정 지출 추가</button></form></section><section className="sales-panel"><h3>예상 인건비</h3><p className="sales-help">등록한 일정 × 현재 시급 기준입니다. 추가수당·공제는 포함하지 않은 기본급 예상액이에요.</p>{salaries.map((item) => <div className="management-cost" key={item.id}><span>{item.name}<small>{hours(item.minutes)}</small></span><strong>{money(item.pay)}</strong></div>)}<div className="management-total"><span>인건비 · 월세 · 고정비 합계</span><strong>{money(total)}</strong></div><p className="sales-help">입력하지 않은 비용은 합계에 포함되지 않아요.</p></section></div>}
    {tab === 'report' && <div className="management-columns"><section className="sales-panel"><div className="sales-section-title"><h3>월간 메일 수신 설정</h3><span className="management-pending">{meta?.emailReady ? (meta.plan.emailRequested ? '수신 중' : '수신 꺼짐') : '메일 준비 중'}</span></div><div className="management-mail-time"><Mail size={24} /><div><strong>매월 1일, 낮 12시</strong><p>한국시간 · 그달 운영 계획</p></div></div><p className="sales-help">알바 예상 기본급, 월세, 추가 고정비와 이번 달 매출 예상액을 모아 받아보는 보고서입니다.</p><label className="management-opt"><input type="checkbox" disabled={!meta?.emailReady && !plan.emailRequested} checked={plan.emailRequested} onChange={(e) => change({ ...plan, emailRequested: e.target.checked })} />월간 보고서 이메일 받기</label><p className="management-recipient">받는 주소: {meta?.recipient || '로그인 후 확인 가능'}</p><p className="management-notice">수신 설정을 바꾼 뒤 아래 저장 버튼을 눌러 주세요. 매월 1일 낮 12시 이전에 수신을 켜면 그달부터 발송합니다. 월말까지 매출을 저장하고 다음 달 근무표·고정비를 채워 주세요. 매출이 부족하면 보고서에 자료 부족으로 표시합니다.</p>{meta?.lastDeliveryMonth && <p className="sales-help">최근 보고서: {meta.lastDeliveryMonth} · {({ SENT: '발송 완료', FAILED: '발송 실패 (자동 재발송 없음)', CLAIMED: '발송 처리 중 또는 결과 확인 필요', CANCELLED: '수신 해제로 취소' } as Record<string, string>)[meta.lastDeliveryStatus || ''] || '확인 중'}</p>}<button type="button" className="sales-save" onClick={onForecast}>매출 예측하러 가기</button></section><section className="sales-panel"><div className="sales-section-title"><h3>{month} 보고서 미리보기</h3><span>현재 입력 기준</span></div><pre className="management-report">{report}</pre><button type="button" className="management-primary" onClick={download}><Download size={16} />보고서 내려받기 (.txt)</button></section></div>}
    <footer className="management-savebar"><div><strong>{dirty ? '저장하지 않은 변경사항이 있어요' : '경영 정보를 가게별로 보관해요'}</strong><p>저장하면 다른 기기에서도 같은 계정으로 확인할 수 있어요. 메일에는 저장한 정보만 반영됩니다.</p></div><button type="button" className="management-primary" onClick={persist} disabled={!key || !ready || saving}><Save size={17} />{saving ? '저장 중…' : '경영 정보 저장'}</button></footer>
    </fieldset>
  </section>
}
