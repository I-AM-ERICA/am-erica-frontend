import { ArrowRight, ChevronRight, CircleHelp, Store } from 'lucide-react'
import { assistants, getAssistant } from '../data'
import type { Activity, PageId, StoreProfile } from '../types'
import './dashboard.css'

interface DashboardProps {
  profile: StoreProfile
  activities: Activity[]
  onNavigate: (page: PageId) => void
  onActivity: (activity: Activity) => void
  onGuide: () => void
}

const actions = [
  { title: '지원 정책 찾기', description: '우리 가게에 필요한 지원 정책을 알아보세요.', button: '정책 알아보기' },
  { title: '가게 홍보하기', description: '가게 소식을 전할 홍보 문안을 준비해요.', button: '홍보 문안 만들기' },
  { title: '고객에게 답장하기', description: '리뷰와 문의에 정성스러운 답변을 준비해요.', button: '답변 작성하기' },
  { title: '매출 분석하기', description: '매출 파일을 넣고 가게의 흐름을 살펴보세요.', button: '매출 살펴보기' },
]

export default function Dashboard({ profile, activities, onNavigate, onActivity, onGuide }: DashboardProps) {
  const recent = activities.filter((activity) => activity.createdAt).slice(0, 2)
  return (
    <div className="simple-dashboard">
      <div className="dashboard-intro">
        <span className="dashboard-store"><Store size={17} />{profile.name}<span>·</span>{profile.category}</span>
        <h1>사장님, 어떤 도움이 필요하세요?</h1>
        <p>필요한 일을 고르면, 비서가 차근차근 도와드릴게요.</p>
      </div>
      <section className="simple-assistant-grid" aria-label="우리 가게 비서 선택">
        {assistants.map(({ id, name, color, icon: Icon }, index) => (
          <button className="simple-assistant-card" key={id} onClick={() => onNavigate(id)}>
            <span className={`assistant-icon ${color}`}><Icon size={28} strokeWidth={1.6} /></span>
            <div className="simple-assistant-copy">
              <span className="simple-assistant-name">{name}</span>
              <h2>{actions[index].title}</h2>
              <p>{actions[index].description}</p>
              <span className="simple-assistant-action">{actions[index].button}<ArrowRight size={17} /></span>
            </div>
          </button>
        ))}
      </section>
      {recent.length > 0 && (
        <section className="simple-recent">
          <div className="section-heading"><h2>최근에 함께한 일</h2><button className="text-button" onClick={() => onNavigate('history')}>전체 보기<ChevronRight size={16} /></button></div>
          <div className="panel">
            {recent.map((activity) => {
              const assistant = getAssistant(activity.assistant)
              const Icon = assistant.icon
              return <button className="simple-recent-row" key={activity.id} onClick={() => onActivity(activity)}><span className={`assistant-icon ${assistant.color}`}><Icon size={19} /></span><span><strong>{activity.title}</strong><small>{assistant.name}</small></span><ChevronRight size={18} /></button>
            })}
          </div>
        </section>
      )}
      <div className="dashboard-guide"><CircleHelp size={22} /><div><strong>처음 사용하시나요?</strong><p>가게비서 사용 방법을 쉽게 알려드릴게요.</p></div><button onClick={onGuide}>사용 방법 보기<ArrowRight size={16} /></button></div>
    </div>
  )
}
