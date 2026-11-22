import { ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check, ChevronRight, LoaderCircle, Plus, Save, Trash2, TrendingUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { loadManagementSales } from '../services/managementApi'
import ManagementPlanner from '../components/ManagementPlanner'
import type { AuthUser } from '../services/auth'
import StaffAvatar from '../components/StaffAvatar'
import { predictSales, shiftDate, todayInSeoul, validateSales } from '../services/sales'
import type { SalesForecast, SalesInput, SalesPredictor } from '../services/sales'
import type { Activity, StoreProfile } from '../types'
import './styles/sales.css'

interface Props { user?: AuthUser | null; profile: StoreProfile; onBack: () => void; onSave: (activity: Activity) => void; onToast: (message: string) => void; onPredict?: SalesPredictor }
interface InputRow extends SalesInput { key: number }
const won = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`
const shortDate = (value: string) => `${Number(value.slice(5, 7))}/${Number(value.slice(8))}`

export default function SalesPage({ user, profile, onBack, onSave, onToast, onPredict = predictSales }: Props) {
  const [mode, setMode] = useState<'forecast' | 'plan'>('forecast')
  const [rows, setRows] = useState<InputRow[]>(() => [{ key: 0, date: shiftDate(todayInSeoul(), -1), amount: '' }])
  const nextKey = useRef(1)
  const [horizon, setHorizon] = useState(1)
  const [result, setResult] = useState<SalesForecast | null>(null)
  const [selected, setSelected] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const cancelled = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort() } }, [])
  const resetResult = () => { setResult(null); setError(''); setSaved(false) }
  const update = (key: number, field: 'date' | 'amount', value: string) => {
    setRows((items) => items.map((row) => row.key === key ? { ...row, [field]: value } : row)); resetResult()
  }
  const addDay = () => {
    const first = rows.map((row) => row.date).filter(Boolean).sort()[0] || todayInSeoul()
    try { setRows((items) => [{ key: nextKey.current++, date: shiftDate(first, -1), amount: '' }, ...items]); resetResult() }
    catch { setError('먼저 입력한 날짜를 확인해 주세요.') }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (request.current) return
    let history
    try { history = validateSales(rows) } catch (cause) { setError((cause as Error).message); return }
    const controller = new AbortController(); request.current = controller; cancelled.current = false
    setBusy(true); resetResult(); setSelected(0)
    let timedOut = false
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 120000)
    try {
      const forecast = await onPredict(history, horizon, profile, controller.signal)
      if (mounted.current && !controller.signal.aborted) setResult(forecast)
    } catch (cause) {
      if (mounted.current) setError(cancelled.current ? '예측을 취소했어요. 입력 내용은 그대로 남아 있어요.' : timedOut ? '예측 시간이 초과됐어요. 다시 시도해 주세요.' : cause instanceof Error && cause.name !== 'TypeError' ? cause.message : '경영 비서 서버에 연결하지 못했어요.')
    } finally { window.clearTimeout(timeout); request.current = null; if (mounted.current) setBusy(false) }
  }
  const loadSales = async () => {
    if (!profile.id || request.current) return
    if (rows.some(row => row.amount !== '') && !window.confirm('입력한 매출을 서버에 저장된 매출로 바꿀까요?')) return
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('')
    const timer = window.setTimeout(() => controller.abort(), 20000)
    try {
      const history = await loadManagementSales(profile.id, controller.signal)
      if (mounted.current && !controller.signal.aborted) {
        if (!history.length) { onToast('아직 저장된 매출이 없어요.'); return }
        setRows(history.map(p => ({ key: nextKey.current++, date: p.date, amount: String(p.amount) }))); resetResult()
      }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : '매출 불러오기를 완료하지 못했어요.') }
    finally { window.clearTimeout(timer); request.current = null; if (mounted.current) setBusy(false) }
  }
  const save = () => {
    if (!result || saved) return
    onSave({ id: crypto.randomUUID(), assistant: 'sales', title: `${result.points[0].date}부터 ${result.points.length}일 매출 예측`,
      description: `Chronos · 실제 매출 ${result.historyDays}일 사용`, createdAt: new Date().toISOString(),
      content: [result.summary, '', ...result.points.map((point) => `${point.date}: ${won(point.predicted)} (예측 범위 ${won(point.lower)} ~ ${won(point.upper)})`), '', 'q10~q90 예측 범위이며 실제 매출을 보장하지 않습니다.'].join('\n') })
    setSaved(true); onToast('예측 결과를 이용 내역에 저장했어요.')
  }
  const point = result?.points[selected]
  const max = result ? Math.max(1, ...result.points.map((item) => item.upper)) : 1
  return <main className="sales-page">
    <button className="sales-back" onClick={onBack}><ArrowLeft size={16} /> 대시보드로</button>
    <header className="sales-heading"><StaffAvatar id="sales" /><div><p>경영 비서</p><h1>매출부터 운영까지, 한눈에</h1><span>매출을 예측하고, 직원 근무표와 매달 나가는 비용을 함께 관리해요.</span></div></header>
    <div className="sales-mode" role="group" aria-label="경영 비서 메뉴"><button type="button" aria-pressed={mode === 'forecast'} onClick={() => setMode('forecast')}>매출 예측</button><button type="button" aria-pressed={mode === 'plan'} onClick={() => setMode('plan')}>직원 · 비용 · 월간 보고서</button></div>
    <div hidden={mode !== 'plan'}><ManagementPlanner key={`${user?.id}:${profile.id}`} user={user} storeId={profile.id} storeName={profile.name} forecast={result} onToast={onToast} onForecast={() => setMode('forecast')} /></div>
    <div hidden={mode !== 'forecast'}>
    <div className="sales-steps"><span><b>1</b> 실제 매출 입력</span><ChevronRight size={14} /><span><b>2</b> 예측 기간 선택</span><ChevronRight size={14} /><span><b>3</b> 예상 매출 확인</span></div>
    <div className="sales-workspace">
      <form className="sales-panel sales-form" onSubmit={submit}>
        <div className="sales-section-title"><h2>우리 가게 매출</h2><span>{rows.length}일 입력</span></div>
        <p className="sales-help">날짜별 총매출을 입력해 주세요. 예측 시 매출을 계정에 저장하며, 월간 메일의 예상 매출 계산에도 사용합니다.</p>
        <fieldset disabled={busy} className="sales-fields">
          <button type="button" className="sales-add" disabled={!profile.id} onClick={loadSales}>저장한 매출 불러오기</button>
          <div className="sales-input-head" aria-hidden="true"><span>매출 날짜</span><span>일매출 (원)</span><span /></div>
          <div className="sales-input-list">{rows.map((row, index) => <div className="sales-input-row" key={row.key}>
            <input aria-label={`${index + 1}행 매출 날짜`} type="date" value={row.date} max={todayInSeoul()} required onChange={(event) => update(row.key, 'date', event.target.value)} />
            <input aria-label={`${index + 1}행 일매출 (원)`} type="text" inputMode="numeric" pattern="[0-9]+" placeholder="예: 520000" value={row.amount} required maxLength={16} onChange={(event) => update(row.key, 'amount', event.target.value)} />
            <button type="button" className="sales-remove" disabled={rows.length === 1} aria-label={`${index + 1}행 삭제`} onClick={() => { setRows((items) => items.filter((item) => item.key !== row.key)); resetResult() }}><Trash2 size={16} /></button>
          </div>)}</div>
          <button type="button" className="sales-add" onClick={addDay} disabled={rows.length >= 512}><Plus size={15} /> 이전 날짜 추가</button>
          <p className="sales-help">빠진 날짜 없이 입력해 주세요. 휴무일은 0원으로 입력하면 됩니다.</p>
          <label className="sales-label" htmlFor="sales-horizon">얼마나 앞을 예측할까요?</label>
          <select id="sales-horizon" value={horizon} onChange={(event) => { setHorizon(Number(event.target.value)); resetResult() }}>
            <option value={1}>다음 날</option><option value={7}>다음 7일</option><option value={14}>다음 14일</option><option value={30}>다음 30일</option>
          </select>
          <p className="sales-help">마지막으로 입력한 매출일의 다음 날부터 예측합니다.</p>
          <button className="sales-submit" type="submit" disabled={!profile.id}>{busy ? <><LoaderCircle className="sales-spin" size={18} /> 매출 예측 중…</> : <>매출 저장하고 예측 <ArrowRight size={17} /></>}</button>
        </fieldset>
        {busy && <button type="button" className="sales-cancel" onClick={() => { cancelled.current = true; request.current?.abort() }}>예측 취소</button>}
        {!profile.id && <p className="sales-help">가게 정보를 먼저 저장해 주세요.</p>}
        {error && <p className="sales-error" role="alert">{error}</p>}
        <div className="sales-input-note"><CalendarDays size={17} /><p>하루치로도 예측할 수 있지만, 매출 이력이 짧으면 반복 패턴을 충분히 반영하기 어려워요.</p></div>
      </form>
      <section className="sales-panel sales-results" aria-live="polite" aria-busy={busy}>
        <div className="sales-section-title"><h2>예상 매출</h2><span className="sales-model">Chronos</span></div>
        {!result || !point ? <div className="sales-empty">{busy ? <LoaderCircle size={40} className="sales-spin" /> : <BarChart3 size={44} />}<h3>{busy ? '매출 흐름을 살펴보고 있어요' : '다가올 매출을 미리 살펴보세요'}</h3><p>{busy ? '입력한 매출로 예상 금액과 범위를 계산합니다.' : '왼쪽에 날짜와 매출을 입력하고\n매출 저장하고 예측를 눌러 주세요.'}</p></div> : <>
          <div className="sales-result-meta">실제 매출 {result.historyDays}일 사용 · {result.points.length}일 예측</div>
          <div className="sales-amount-card"><span>{point.date} 예상 매출</span><strong>{won(point.predicted)}</strong><p>예측 범위 <b>{won(point.lower)} ~ {won(point.upper)}</b></p></div>
          <p className="sales-summary">{result.summary}</p>
          {result.points.length > 1 && <div className="sales-chart" role="group" aria-label="날짜별 예상 매출. 막대를 선택하면 금액을 확인할 수 있습니다.">{result.points.map((item, index) => <button type="button" key={item.date} aria-pressed={selected === index} aria-label={`${item.date} 예상 매출 ${won(item.predicted)}`} onClick={() => setSelected(index)}>
            <span className="sales-bar-track"><span className="sales-range" style={{ bottom: `${item.lower / max * 100}%`, height: `${(item.upper - item.lower) / max * 100}%` }} /><span className="sales-bar" style={{ height: `${Math.max(1, item.predicted / max * 100)}%` }} /></span><span>{shortDate(item.date)}</span>
          </button>)}</div>}
          <p className="sales-range-note">예상 매출은 중앙값(q50), 범위는 q10~q90입니다. 실제 매출을 보장하는 범위는 아닙니다.</p>
          <div className="sales-table-wrap"><table><caption>날짜별 예상 매출과 예측 범위</caption><thead><tr><th>날짜</th><th>예상 매출</th><th>예측 범위</th></tr></thead><tbody>{result.points.map((item, index) => <tr key={item.date} className={selected === index ? 'is-selected' : ''}><td><button type="button" onClick={() => setSelected(index)}>{shortDate(item.date)}</button></td><td>{won(item.predicted)}</td><td>{won(item.lower)} ~ {won(item.upper)}</td></tr>)}</tbody></table></div>
          <button className="sales-save" onClick={save} disabled={saved}>{saved ? <Check size={16} /> : <Save size={16} />}{saved ? '이용 내역에 저장했어요' : '예측 결과 저장'}</button>
        </>}
      </section>
    </div>
    <aside className="sales-explanation"><TrendingUp size={19} /><div><strong>어떤 정보로 예측하나요?</strong><p>입력한 일별 매출의 흐름을 사용합니다. 날씨·행사·업종·비용은 반영하지 않으며, 순이익이나 시간대별 피크타임을 예측하는 기능은 아닙니다. 현재 모델은 영국 소매업체 매출로 학습되어 우리 매장에서는 참고용으로 활용해 주세요.</p></div></aside>
    </div>
  </main>
}
