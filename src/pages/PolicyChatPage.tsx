import { ArrowLeft, ArrowUp, Copy, ExternalLink, MessageSquarePlus, RotateCcw, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import StaffAvatar from '../components/StaffAvatar'
import PolicyReminderToggle from '../components/PolicyReminderToggle'
import { askPolicy, policyHistory, readPolicyConversation, savePolicyConversation } from '../services/policy-chat'
import type { PolicyMessage } from '../services/policy-chat'
import type { Activity, StoreProfile } from '../types'
import './styles/policy-chat.css'

interface PolicyChatProps {
  profile: StoreProfile
  storageKey: string
  onBack: () => void
  onSave: (activity: Activity) => void
  onToast: (message: string) => void
}
const suggestions = ['소상공인시장진흥공단 정책자금의 공통 지원 자격을 공식 자료로 확인해줘.', '우리 가게가 받을 수 있는 지원금이 있을까요?', '운영자금 지원을 받으려면 무엇을 준비해야 하나요?', '지역별 소상공인 지원 정책을 찾아주세요.']

export default function PolicyChatPage({ profile, storageKey, onBack, onSave, onToast }: PolicyChatProps) {
  const [messages, setMessages] = useState<PolicyMessage[]>(() => readPolicyConversation(storageKey))
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [mailBusy, setMailBusy] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  const [formError, setFormError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const stopped = useRef(false)
  const mounted = useRef(true)
  const transcript = useRef<HTMLDivElement>(null)
  const followBottom = useRef(true)
  const input = useRef<HTMLTextAreaElement>(null)
  const latest = useRef(messages)
  latest.current = messages

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controller.current?.abort()
      savePolicyConversation(storageKey, latest.current)
    }
  }, [storageKey])
  useEffect(() => {
    const timer = window.setTimeout(() => setStorageWarning(!savePolicyConversation(storageKey, messages)), 350)
    return () => window.clearTimeout(timer)
  }, [messages, storageKey])
  useEffect(() => {
    if (followBottom.current && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [messages, busy])
  useEffect(() => {
    if (!input.current) return
    input.current.style.height = 'auto'
    input.current.style.height = `${Math.min(input.current.scrollHeight, 160)}px`
  }, [draft])

  const send = async (question: string, retry = false) => {
    if (controller.current || mailBusy || !question.trim()) return
    if (question.length > 1000) { setFormError('질문은 1,000자 이내로 입력해 주세요.'); return }
    setFormError('')
    const previous = retry ? messages.slice(0, -2) : messages
    const userMessage: PolicyMessage = retry ? messages[messages.length - 2] : { id: crypto.randomUUID(), role: 'user', content: question.trim(), status: 'complete' }
    const assistantId = crypto.randomUUID()
    const pending: PolicyMessage = { id: assistantId, role: 'assistant', content: '', status: 'streaming' }
    setMessages([...previous, userMessage, pending].slice(-40))
    setDraft('')
    setBusy(true)
    stopped.current = false
    followBottom.current = true
    const request = new AbortController()
    controller.current = request
    let timedOut = false
    const timer = window.setTimeout(() => { timedOut = true; request.abort() }, 120000)
    const updateMessage = (change: Partial<PolicyMessage>) => {
      if (mounted.current) setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, ...change } : message))
    }
    try {
      const result = await askPolicy(question, policyHistory(previous), profile, ({ text, sources }) => updateMessage({ content: text, sources }), request.signal)
      updateMessage({ content: result.text, sources: result.sources, status: 'complete' })
      if (mounted.current) onSave({ id: crypto.randomUUID(), assistant: 'policy', title: question.trim().slice(0, 38), description: '정책 비서 대화', content: `질문: ${question.trim()}\n\n${result.text}`, createdAt: new Date().toISOString() })
    } catch (error) {
      if (stopped.current) updateMessage({ status: 'stopped' })
      else updateMessage({ status: 'error', error: timedOut ? '답변 준비 시간이 초과됐어요. 다시 시도해 주세요.' : error instanceof Error && error.name !== 'TypeError' ? error.message : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' })
    } finally {
      window.clearTimeout(timer)
      controller.current = null
      if (mounted.current) { setBusy(false); input.current?.focus() }
    }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void send(draft) }
  const startNew = () => {
    if (busy || mailBusy) return
    setMessages([]); setDraft(''); setFormError('')
    setStorageWarning(!savePolicyConversation(storageKey, []))
    input.current?.focus()
  }

  return <section className="policy-chat" aria-label="정책 비서 채팅">
    <header className="policy-chat-header">
      <button className="policy-chat-back" onClick={onBack} aria-label="비서 선택으로 돌아가기"><ArrowLeft size={20} /></button>
      <StaffAvatar id="policy" />
      <div className="policy-chat-heading"><h1>정책 비서</h1><p>{profile.name}에 맞는 지원 정책을 함께 찾아봐요.</p></div>
      <button className="policy-new-chat" onClick={startNew} disabled={busy || mailBusy}><MessageSquarePlus size={18} /><span>새 대화</span></button>
    </header>
    <PolicyReminderToggle profile={profile} chatBusy={busy} onBusyChange={setMailBusy} onResult={(result) => {
      followBottom.current = true
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'user' as const, content: '현재 신청할 수 있는 정책을 검색하고 이메일로 보내주세요.', status: 'complete' as const,
      }, {
        id: crypto.randomUUID(), role: 'assistant' as const, content: result.content, status: 'complete' as const,
      }].slice(-40))
      onSave({ id: crypto.randomUUID(), assistant: 'policy', title: '정책 검색 결과 이메일 발송', description: '정책 비서 이메일', content: result.content, createdAt: new Date().toISOString() })
    }} />
    <div className="policy-transcript" ref={transcript} onScroll={() => { const el = transcript.current; if (el) followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
      {messages.length === 0 ? <div className="policy-chat-empty">
        <StaffAvatar id="policy" />
        <p className="policy-chat-eyebrow">사장님의 든든한 정책 비서</p>
        <h2>어떤 지원이 필요하세요?</h2>
        <p>지원금부터 신청 조건, 준비 서류까지.<br />궁금한 내용을 편하게 물어보세요.</p>
        <div className="policy-suggestions">{suggestions.map((question) => <button key={question} onClick={() => { setDraft(question); input.current?.focus() }}>{question}<ArrowUp size={16} /></button>)}</div>
      </div> : <div className="policy-message-list" role="log" aria-label="정책 비서 대화 내역" aria-live="off">
        {messages.map((message, index) => <article key={message.id} className={`policy-message policy-message-${message.role}`} aria-label={message.role === 'user' ? '내 질문' : '정책 비서 답변'}>
          {message.role === 'assistant' && <StaffAvatar id="policy" />}
          <div className="policy-message-body">
            {message.role === 'assistant' && <div className="policy-message-author">정책 비서{message.content.startsWith('[MOCK]') && <span>예시 응답</span>}</div>}
            {message.content && <div className="policy-message-text">{message.content}</div>}
            {message.status === 'streaming' && <span className="policy-thinking"><i /><i /><i /><span>{message.content ? '답변 작성 중' : '정책을 확인하고 있어요'}</span></span>}
            {message.status === 'stopped' && <p className="policy-message-note">답변 생성을 중지했어요.</p>}
            {message.status === 'error' && <p className="policy-message-error" role="alert">{message.error || '답변을 받지 못했어요.'}</p>}
            {!!message.sources?.length && <div className="policy-sources"><strong>출처</strong>{message.sources.map((source, sourceIndex) => <a key={`${source.url}-${sourceIndex}`} href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink size={13} /></a>)}</div>}
            {message.role === 'assistant' && message.status !== 'streaming' && <div className="policy-message-actions">
              {message.content && <button aria-label="답변 복사" onClick={async () => { try { await navigator.clipboard.writeText(message.content); onToast('답변을 복사했어요.') } catch { onToast('복사 권한을 확인해 주세요.') } }}><Copy size={14} />복사</button>}
              {(message.status === 'error' || message.status === 'stopped') && index === messages.length - 1 && messages[index - 1]?.role === 'user' && <button disabled={busy} onClick={() => void send(messages[index - 1].content, true)}><RotateCcw size={14} />다시 시도</button>}
            </div>}
          </div>
        </article>)}
      </div>}
    </div>
    <div className="policy-composer-wrap">
      {storageWarning && <p className="policy-message-note" role="status">브라우저에 대화를 저장하지 못했어요. 이번 화면에서만 유지됩니다.</p>}
      {formError && <p className="policy-message-error" role="alert">{formError}</p>}
      <form className="policy-composer" onSubmit={submit}>
        <textarea ref={input} id="policy-chat-input" aria-label="정책 비서에게 질문하기" placeholder="지원 정책에 대해 물어보세요" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} rows={1} onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); if (!busy) void send(draft) }
        }} />
        {busy ? <button type="button" className="policy-send" aria-label="답변 생성 중지" onClick={() => { stopped.current = true; controller.current?.abort() }}><Square size={16} fill="currentColor" /></button> : <button type="submit" className="policy-send" aria-label="질문 보내기" disabled={!draft.trim() || mailBusy}><ArrowUp size={22} /></button>}
      </form>
      <div className="policy-composer-hint"><span>Enter로 전송 · Shift+Enter로 줄바꿈</span><span>{draft.length}/1,000</span></div>
      <p className="policy-chat-disclaimer">신청 조건과 접수 기간은 공식 공고에서 확인해 주세요.</p>
      <span className="visually-hidden" role="status">{busy ? '정책 비서가 답변을 작성하고 있습니다.' : messages.length ? '답변 처리가 끝났습니다.' : ''}</span>
    </div>
  </section>
}
