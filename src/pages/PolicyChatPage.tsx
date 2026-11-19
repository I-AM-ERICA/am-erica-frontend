import { ArrowLeft, ArrowUp, Bell, Copy, ExternalLink, MessageSquarePlus, RotateCcw, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import StaffAvatar from '../components/StaffAvatar'
import PolicyReminderToggle from '../components/PolicyReminderToggle'
import { askPolicyConversation, createPolicyConversation, getPolicyConversation, listPolicyConversations, stopPolicyConversation } from '../services/policy-conversations'
import type { PolicyConversation } from '../services/policy-conversations'
import type { PolicyMessage } from '../services/policy-chat'
import type { Activity, StoreProfile } from '../types'
import './styles/policy-chat.css'

interface PolicyChatProps {
  profile: StoreProfile
  onBack: () => void
  onSave: (activity: Activity) => void
  onToast: (message: string) => void
}
const suggestions = ['소상공인시장진흥공단 정책자금의 공통 지원 자격을 공식 자료로 확인해줘.', '우리 가게가 받을 수 있는 지원금이 있을까요?', '운영자금 지원을 받으려면 무엇을 준비해야 하나요?', '지역별 소상공인 지원 정책을 찾아주세요.']

export default function PolicyChatPage({ profile, onBack, onSave, onToast }: PolicyChatProps) {
  const [messages, setMessages] = useState<PolicyMessage[]>([])
  const [conversations, setConversations] = useState<PolicyConversation[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const activeId = useRef<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [storageError, setStorageError] = useState('')
  const loadSequence = useRef(0)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [mailBusy, setMailBusy] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(true)
  const reminderButton = useRef<HTMLButtonElement>(null)
  const [formError, setFormError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const stopped = useRef(false)
  const mounted = useRef(true)
  const transcript = useRef<HTMLDivElement>(null)
  const followBottom = useRef(true)
  const input = useRef<HTMLTextAreaElement>(null)
  const remotePending = !busy && messages.some(message => message.status === 'streaming')
  const blocked = busy || mailBusy || loading || !!storageError || remotePending

  const load = async (selected?: number | null, signal = AbortSignal.timeout(15000)) => {
    const sequence = ++loadSequence.current
    setLoading(true)
    try {
      const rooms = await listPolicyConversations(signal)
      const id = selected === undefined ? rooms[0]?.id ?? null : selected
      if (mounted.current && sequence === loadSequence.current) setConversations(rooms)
      const detail = id === null ? null : await getPolicyConversation(id, signal)
      if (!mounted.current || sequence !== loadSequence.current || signal.aborted) return
      activeId.current = id; setConversationId(id)
      setMessages(detail?.messages ?? []); setStorageError('')
    } catch (error) {
      if (mounted.current && sequence === loadSequence.current) setStorageError(error instanceof Error && !['TypeError', 'TimeoutError', 'AbortError'].includes(error.name)
        ? error.message : '대화를 불러오지 못했어요. 연결을 확인하고 다시 불러와 주세요.')
    } finally { if (mounted.current && sequence === loadSequence.current) setLoading(false) }
  }
  useEffect(() => {
    mounted.current = true
    const request = new AbortController()
    void load(undefined, AbortSignal.any([request.signal, AbortSignal.timeout(15000)]))
    return () => { mounted.current = false; loadSequence.current++; request.abort(); controller.current?.abort() }
    // Each mounted page belongs to one authenticated account/store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!remotePending || mailBusy || loading || storageError) return
    const timer = window.setTimeout(() => { void load(activeId.current) }, 3000)
    return () => window.clearTimeout(timer)
  }, [remotePending, mailBusy, loading, storageError, messages])
  useEffect(() => {
    if (followBottom.current && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [messages, busy, reminderOpen])
  useEffect(() => {
    if (!input.current) return
    input.current.style.height = 'auto'
    input.current.style.height = `${Math.min(input.current.scrollHeight, 160)}px`
  }, [draft])

  const ensureConversation = async (signal: AbortSignal) => {
    if (activeId.current !== null) return activeId.current
    const room = await createPolicyConversation(profile, signal)
    if (mounted.current) {
      activeId.current = room.id; setConversationId(room.id)
      setConversations(current => [room, ...current.filter(item => item.id !== room.id)].slice(0, 5))
    }
    return room.id
  }
  const send = async (question: string) => {
    if (controller.current || blocked || !question.trim()) return
    if (question.length > 1000) { setFormError('질문은 1,000자 이내로 입력해 주세요.'); return }
    setFormError('')
    const userMessage: PolicyMessage = { id: crypto.randomUUID(), role: 'user', content: question.trim(), status: 'complete' }
    const assistantId = crypto.randomUUID()
    const pending: PolicyMessage = { id: assistantId, role: 'assistant', content: '', status: 'streaming' }
    setMessages(current => [...current, userMessage, pending])
    setDraft(''); setBusy(true); stopped.current = false; followBottom.current = true
    const request = new AbortController()
    controller.current = request
    let roomId: number | null = null
    let timedOut = false
    const timer = window.setTimeout(() => { timedOut = true; request.abort() }, 120000)
    const updateMessage = (change: Partial<PolicyMessage>) => {
      if (mounted.current) setMessages(current => current.map(message => message.id === assistantId ? { ...message, ...change } : message))
    }
    try {
      roomId = await ensureConversation(request.signal)
      const result = await askPolicyConversation(roomId, userMessage.id, question, ({ text, sources }) => updateMessage({ content: text, sources }), request.signal)
      updateMessage({ content: result.text, sources: result.sources, status: 'complete' })
      if (mounted.current) onSave({ id: crypto.randomUUID(), assistant: 'policy', title: question.trim().slice(0, 38), description: '정책 비서 대화', content: `질문: ${question.trim()}\n\n${result.text}`, createdAt: new Date().toISOString() })
    } catch (error) {
      if (request.signal.aborted && roomId !== null) {
        try { await stopPolicyConversation(roomId, userMessage.id) }
        catch { if (mounted.current) setFormError('중지 상태를 확인하지 못했어요. 대화를 다시 불러와 확인해 주세요.') }
      }
      if (stopped.current) updateMessage({ status: 'stopped' })
      else {
        const message = timedOut ? '답변 준비 시간이 초과됐어요. 다시 시도해 주세요.' : error instanceof Error && error.name !== 'TypeError' ? error.message : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'
        updateMessage({ status: 'error', error: message })
        if (mounted.current) { setFormError(message); setDraft(question) }
      }
    } finally {
      window.clearTimeout(timer)
      if (mounted.current) await load(roomId ?? activeId.current)
      controller.current = null
      if (mounted.current) { setBusy(false); input.current?.focus() }
    }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void send(draft) }
  const startNew = () => {
    if (busy || mailBusy || loading || storageError) return
    loadSequence.current++; activeId.current = null; setConversationId(null)
    setMessages([]); setDraft(''); setFormError(''); input.current?.focus()
  }

  return <section className="policy-chat" aria-label="정책 비서 채팅">
    <header className="policy-chat-header">
      <button className="policy-chat-back" onClick={onBack} aria-label="비서 선택으로 돌아가기"><ArrowLeft size={20} /></button>
      <StaffAvatar id="policy" />
      <div className="policy-chat-heading"><h1>정책 비서</h1><p>{profile.name}에 맞는 지원 정책을 함께 찾아봐요.</p></div>
      <button ref={reminderButton} type="button" className="policy-reminder-opener"
        aria-label={reminderOpen ? '이메일 알림 영역 닫기' : '이메일 알림 영역 열기'}
        title={reminderOpen ? '이메일 알림 영역 닫기' : '이메일 알림 영역 열기'}
        aria-expanded={reminderOpen} aria-controls="policy-reminder-panel"
        onClick={() => setReminderOpen((open) => !open)}><Bell size={20} aria-hidden="true" /></button>
      <button className="policy-new-chat" onClick={startNew} disabled={busy || mailBusy || loading || !!storageError}><MessageSquarePlus size={18} /><span>새 대화</span></button>
    </header>
    <div className="policy-conversations">
      <label htmlFor="policy-conversation-select">최근 대화</label>
      <select id="policy-conversation-select" value={conversationId ?? ''} disabled={busy || mailBusy || loading}
        onChange={event => { setDraft(''); setFormError(''); followBottom.current = true; void load(event.target.value ? Number(event.target.value) : null) }}>
        <option value="">새 대화</option>
        {conversations.map(room => <option key={room.id} value={room.id}>{room.title}</option>)}
      </select>
      <span>{loading ? '불러오는 중…' : '최근 대화방 5개가 계정에 저장됩니다.'}</span>
    </div>
    {storageError && <div className="policy-history-error" role="alert"><p>{storageError}</p><button type="button" disabled={loading || busy || mailBusy} onClick={() => void load()}>다시 불러오기</button></div>}
    <PolicyReminderToggle profile={profile} hidden={!reminderOpen} onClose={() => {
      setReminderOpen(false)
      reminderButton.current?.focus()
    }} chatBusy={busy || loading || !!storageError || remotePending} prepareConversation={ensureConversation}
      onBusyChange={value => { setMailBusy(value); if (!value && mounted.current) void load(activeId.current) }} onResult={(result) => {
      followBottom.current = true
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
              {(message.status === 'error' || message.status === 'stopped') && index === messages.length - 1 && messages[index - 1]?.role === 'user' && <button disabled={blocked} onClick={() => void send(messages[index - 1].content)}><RotateCcw size={14} />다시 시도</button>}
            </div>}
          </div>
        </article>)}
      </div>}
    </div>
    <div className="policy-composer-wrap">
      {remotePending && <p className="policy-message-note" role="status">이 대화의 답변을 처리 중이에요. 완료되면 자동으로 불러옵니다.</p>}
      {formError && <p className="policy-message-error" role="alert">{formError}</p>}
      <form className="policy-composer" onSubmit={submit}>
        <textarea ref={input} id="policy-chat-input" aria-label="정책 비서에게 질문하기" placeholder="지원 정책에 대해 물어보세요" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} rows={1} onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); if (!busy) void send(draft) }
        }} />
        {busy ? <button type="button" className="policy-send" aria-label="답변 생성 중지" onClick={() => { stopped.current = true; controller.current?.abort() }}><Square size={16} fill="currentColor" /></button> : <button type="submit" className="policy-send" aria-label="질문 보내기" disabled={!draft.trim() || blocked}><ArrowUp size={22} /></button>}
      </form>
      <div className="policy-composer-hint"><span>Enter로 전송 · Shift+Enter로 줄바꿈</span><span>{draft.length}/1,000</span></div>
      <p className="policy-chat-disclaimer">신청 조건과 접수 기간은 공식 공고에서 확인해 주세요.</p>
      <span className="visually-hidden" role="status">{busy ? '정책 비서가 답변을 작성하고 있습니다.' : messages.length ? '답변 처리가 끝났습니다.' : ''}</span>
    </div>
  </section>
}
