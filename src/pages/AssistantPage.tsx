import CustomerReplyOptions from '../components/CustomerReplyOptions'
import CustomerReplySummary from '../components/CustomerReplySummary'
import { ArrowLeft, ArrowRight, Check, Copy, Download, ExternalLink, FileUp, Info, LoaderCircle, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import StaffAvatar from '../components/StaffAvatar'
import { getAssistant } from '../data'
import { isLiveMode, runAssistant } from '../services/assistant'
import type { Activity, AssistantId, AssistantResult, StoreProfile } from '../types'
import './styles/workspace.css'

const options = {
  policy: ['지원 정책 탐색', '운영자금', '디지털 전환', '지역 지원사업'],
  marketing: ['카드뉴스 문안', '숏폼 기획', '인스타그램 게시글'],
  customer: ['리뷰 답글'],
  sales: ['매출·피크타임 분석'],
}
const examples = {
  policy: ['가게 운영자금 관련 지원을 찾고 있어요.', '가게 홍보를 시작할 때 확인할 지원사업이 있나요?', '온라인 주문 시스템 도입을 준비하고 있어요.'],
  marketing: ['신메뉴 딸기 라떼 출시 소식을 알리고 싶어요.', '평일 오후 아메리카노 10% 할인 행사를 홍보해 주세요.', '우리 가게의 아늑한 분위기를 소개하고 싶어요.'],
  customer: ['커피가 맛있고 매장이 아늑해요. 다음에 또 올게요!', '음료가 나오기까지 오래 기다렸어요.', '직원분들이 친절하고 디저트도 맛있었어요.'],
  sales: ['날짜,시간,매출\n2026-11-01,10,85000\n2026-11-01,12,210000\n2026-11-01,15,125000\n2026-11-02,10,95000\n2026-11-02,12,245000\n2026-11-02,15,140000'],
}

export default function AssistantPage({ id, profile, onBack, onSave, onToast }: { id: AssistantId; profile: StoreProfile; onBack: () => void; onSave: (activity: Activity) => void; onToast: (message: string) => void }) {
  const assistant = getAssistant(id)
  const live = id === 'customer' || isLiveMode
  const [rating, setRating] = useState(0)
  // 고객응대 답글에 쓰는 가게 정보: 이 브라우저에 가게별로 기억해 둡니다 (서버 DB에는 저장하지 않음).
  const storeInfoKey = `gage-customer-store-info-${profile.id ?? 'none'}`
  const [storeInfo, setStoreInfo] = useState(() => { try { return localStorage.getItem(storeInfoKey) ?? '' } catch { return '' } })
  const saveStoreInfo = (value: string) => { setStoreInfo(value); try { localStorage.setItem(storeInfoKey, value) } catch { /* 이번 방문 중에만 유지됩니다. */ } }
  const requiredReplyTextKey = `gage-customer-required-reply-text-${profile.id ?? 'none'}`
  const [requiredReplyText, setRequiredReplyText] = useState('')
  useEffect(() => {
    try {
      setRequiredReplyText(localStorage.getItem(requiredReplyTextKey) ?? '')
    } catch {
      setRequiredReplyText('')
    }
  }, [requiredReplyTextKey])
  const saveRequiredReplyText = (value: string) => {
    setRequiredReplyText(value)
    try {
      localStorage.setItem(requiredReplyTextKey, value)
    } catch {
      // 이번 방문 중에만 유지됩니다.
    }
  }
  const [message, setMessage] = useState('')
  const [format, setFormat] = useState(options[id][0])
  const [result, setResult] = useState<AssistantResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!message.trim()) { setError('내용을 입력해 주세요.'); return }
    const trimmedStoreInfo = storeInfo.trim()
    const sentence = requiredReplyText.trim()
    const requiredLine = sentence ? `필수: ${sentence}` : ''
    const hasRequiredLine = trimmedStoreInfo.split(/\r?\n/).some(line => line.trim() === requiredLine)
    const storeInfoForRequest = requiredLine && !hasRequiredLine
      ? [trimmedStoreInfo, requiredLine].filter(Boolean).join('\n')
      : trimmedStoreInfo

    if (id === 'customer' && storeInfoForRequest.length > 2000) {
      setError('가게 정보와 모든 답글에 넣을 문장을 합쳐 2,000자 이내로 줄여 주세요.')
      return
    }
    setBusy(true); setError(''); setResult(null)
    controller.current = new AbortController()
    const activeController = controller.current
    const timeout = window.setTimeout(() => activeController.abort(), id === 'customer' ? 330000 : 30000)
    try {
      const response = await runAssistant(id, { message: message.trim(), format, profile, ...(id === 'customer' ? { rating, tone: '정중하고 따뜻하게', storeInfo: storeInfoForRequest } : {}) }, controller.current.signal)
      if (controller.current.signal.aborted) return
      setResult(response)
      onSave({ id: crypto.randomUUID(), assistant: id, title: id === 'sales' ? '업로드 매출 데이터 분석' : message.trim().slice(0, 38), description: `${format} · ${live ? 'AI 생성' : id === 'sales' ? '데이터 계산' : '체험 결과'}`, createdAt: new Date().toISOString(), content: response.text })
    } catch (caught) {
      setError(caught instanceof Error && caught.name !== 'AbortError' ? caught.message : '응답 시간이 초과됐어요. 다시 시도해 주세요.')
    } finally { window.clearTimeout(timeout); setBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(result?.text ?? ''); setCopied(true); onToast('결과를 복사했어요.'); window.setTimeout(() => setCopied(false), 2000) }
    catch { onToast('복사 권한을 확인해 주세요. 결과를 직접 선택해서 복사할 수도 있어요.') }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([result?.text ?? ''], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `가게비서_${assistant.name}_${new Date().toISOString().slice(0, 10)}.txt`; link.click(); URL.revokeObjectURL(url)
  }
  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={14} />비서 선택으로 돌아가기</button>
    <div className="workspace-heading"><StaffAvatar id={id} /><div><p className="eyebrow">{assistant.label}</p><h1>{assistant.title}</h1><p>{assistant.description.replace('\n', ' ')}</p></div></div>
    <div className="mode-notice"><Info size={16} /><p>{id === 'customer' ? 'AI가 리뷰에 맞는 답글 초안을 만듭니다. 내용을 확인하고 수정한 뒤 사용해 주세요. 자동으로 게시되지 않아요.' : live ? '연결된 AI 비서가 답변합니다. 중요한 정보는 원문과 함께 확인해 주세요.' : id === 'sales' ? '입력한 CSV를 브라우저에서 계산합니다. 매출 데이터는 서버로 전송되지 않아요.' : '지금은 예시 문안으로 체험할 수 있어요. 결과는 사용 전에 확인해 주세요.'}</p></div>
    <div className="workspace-grid"><form className="panel workspace-form" onSubmit={submit}><div className="section-heading"><h2>{id === 'sales' ? '매출 데이터 입력' : id === 'customer' ? '답글을 달 리뷰를 알려주세요' : '어떤 도움이 필요하세요?'}</h2><span className="step-label">1. 내용 입력</span></div>{id !== 'customer' && <><label htmlFor="format">{id === 'marketing' ? '만들고 싶은 콘텐츠' : '도움받을 분야'}</label><select id="format" value={format} onChange={(event) => setFormat(event.target.value)}>{options[id].map((option) => <option key={option}>{option}</option>)}</select></>}<label htmlFor="assistant-message">{id === 'policy' ? '가게 상황과 궁금한 점' : id === 'marketing' ? '홍보하고 싶은 소식' : id === 'customer' ? '고객 리뷰' : '매출 CSV'}</label><textarea id="assistant-message" className={id === 'sales' ? 'csv-input' : ''} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={id === 'sales' ? '날짜,시간,매출\n2026-11-01,12,150000' : examples[id][0]} rows={id === 'sales' ? 9 : 7} required maxLength={id === 'sales' ? 1000000 : id === 'customer' ? 2000 : 5000} /><div className="input-caption">{id === 'sales' ? '필수 열: 매출 또는 amount · 선택 열: 날짜, 시간' : id === 'customer' ? '고객이 남긴 리뷰를 그대로 붙여 넣어 주세요. 최대 2,000자까지 입력할 수 있어요.' : '구체적으로 알려주실수록 더 알맞은 결과를 만들 수 있어요.'}</div>{id === 'sales' && <><input ref={fileInput} type="file" accept=".csv,text/csv" className="visually-hidden" aria-label="매출 CSV 파일 선택" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 1000000) { setError('1MB 이하 CSV 파일을 선택해 주세요.'); return } try { setMessage(await file.text()); setError('') } catch { setError('파일을 읽지 못했어요. UTF-8 CSV 파일을 확인해 주세요.') } event.target.value = '' }} /><button type="button" className="upload-button" onClick={() => fileInput.current?.click()}><FileUp size={17} />CSV 파일 불러오기<span>최대 1MB · UTF-8</span></button></>}{id === 'customer' && <CustomerReplyOptions rating={rating} storeInfo={storeInfo} requiredReplyText={requiredReplyText} disabled={busy} onRating={setRating} onStoreInfo={saveStoreInfo} onRequiredReplyText={saveRequiredReplyText} />}<details className="example-prompts"><summary>{id === 'sales' ? '예시 데이터로 먼저 해보기' : '입력이 어렵다면 예시 보기'}</summary>{examples[id].map((example, index) => <button type="button" key={example} onClick={() => { setMessage(example); setError('') }}><span>{id === 'sales' ? '예시 매출 데이터 채우기' : example}</span><ArrowRight size={12} /><span className="visually-hidden">예시 {index + 1} 선택</span></button>)}</details>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button submit-button" disabled={busy} type="submit">{busy ? <LoaderCircle size={16} className="spin" /> : <Send size={15} />}{busy ? '결과를 준비하고 있어요' : id === 'sales' ? '매출 분석하기' : id === 'customer' ? '리뷰 답글 만들기' : isLiveMode ? '비서에게 요청하기' : '체험 결과 만들기'}</button><span className="privacy-caption"><ShieldCheck size={12} />{live ? '입력한 내용은 답글 생성을 위해 서버로 전송됩니다.' : '입력한 내용과 결과는 이 브라우저에만 보관됩니다.'}</span></form>
    <section className="panel workspace-result" aria-label="비서 작업 결과" aria-live="polite"><div className="section-heading"><h2>{id === 'sales' ? '매출 분석 결과' : id === 'customer' ? '리뷰 답글 초안' : '비서가 준비한 결과'}</h2>{result && <div className="result-actions"><button className="result-action" aria-label="결과 복사" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}복사</button><button className="result-action" aria-label="결과 다운로드" onClick={download}><Download size={16} />저장</button></div>}</div>{result ? <>{id === 'customer' && result.customer && <CustomerReplySummary result={result.customer} />}<textarea aria-label="수정 가능한 작업 결과" className="result-text" value={result.text} onChange={(event) => setResult({ ...result, text: event.target.value })} /><p className="input-caption">결과를 직접 수정한 뒤 복사하거나 내려받을 수 있어요. 이용 내역에는 처음 생성한 결과가 보관됩니다.</p>{result.sources && result.sources.length > 0 && <div className="source-links"><strong>공식 사이트에서 확인하기</strong>{result.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink size={12} /></a>)}</div>}</> : <div className="result-placeholder"><StaffAvatar id={id} className="result-placeholder-icon" /><h3>{busy ? '잠시만 기다려 주세요' : '사장님의 일을 함께할 준비가 됐어요'}</h3><p>{busy ? (id === 'customer' ? '리뷰에 맞는 답글을 작성하고 있어요.\n보통 1~2분 정도 걸리며, 상황에 따라 더 걸릴 수 있어요.' : '입력한 내용을 바탕으로 결과를 준비하고 있어요.') : id === 'customer' ? '고객 리뷰를 입력해 주세요.\n이곳에서 답글을 확인하고 다듬을 수 있어요.' : '내용을 입력하고 요청해 주세요.\n이곳에서 결과를 확인하고 다듬을 수 있어요.'}</p></div>}</section></div>
  </>
}
