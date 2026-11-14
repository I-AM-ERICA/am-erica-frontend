import { ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import StaffAvatar from '../components/StaffAvatar'
import { assistants, getAssistant } from '../data'
import type { Activity, AssistantId } from '../types'

export default function HistoryPage({ activities, onOpen }: { activities: Activity[]; onOpen: (activity: Activity) => void }) {
  const [filter, setFilter] = useState<AssistantId | 'all'>('all')
  const [query, setQuery] = useState('')
  const visible = activities.filter((activity) => (filter === 'all' || activity.assistant === filter) && `${activity.title} ${activity.description} ${activity.content}`.toLowerCase().includes(query.toLowerCase()))
  return <><div className="page-heading"><p className="eyebrow">비서와 함께 쌓아가는 가게의 기록</p><h1>이용 내역</h1><p>함께한 작업을 다시 확인하고, 필요한 내용을 꺼내 쓰세요.</p></div><div className="history-toolbar"><div className="history-filters"><button className={filter === 'all' ? 'selected' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>전체 {activities.length}</button>{assistants.map((assistant) => <button key={assistant.id} className={filter === assistant.id ? 'selected' : ''} aria-pressed={filter === assistant.id} onClick={() => setFilter(assistant.id)}>{assistant.name}</button>)}</div><div className="history-search"><Search size={15} /><input aria-label="이용 내역 검색" placeholder="작업 내용 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="panel history-list">{visible.length ? visible.map((activity) => { const assistant = getAssistant(activity.assistant); return <button className="history-item" key={activity.id} onClick={() => onOpen(activity)}><StaffAvatar id={activity.assistant} /><div><h3>{activity.title}</h3><p>{assistant.name} · {activity.description}</p></div><time>{activity.createdAt ? new Date(activity.createdAt).toLocaleDateString('ko-KR') : '체험용 예시'}</time><ChevronRight size={16} /></button> }) : <p className="empty-state">해당하는 작업이 없어요.<br />다른 검색어를 입력하거나 비서와 새로운 작업을 시작해 보세요.</p>}</div><p className="input-caption">작업 내역은 현재 브라우저에 최대 50개 보관됩니다. 브라우저 데이터를 지우면 내역도 삭제됩니다.</p></>
}
