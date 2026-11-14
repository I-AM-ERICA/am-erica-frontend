import { ArrowRight, ChevronRight, CircleHelp, Store } from 'lucide-react'
import { useContext } from 'react'
import StaffAvatar from '../components/StaffAvatar'
import { StaffPreferencesContext } from '../services/staff'
import type { StaffGender } from '../services/staff'
import { assistants, getAssistant } from '../data'
import type { Activity, AssistantId, PageId, StoreProfile } from '../types'
import './styles/dashboard.css'

interface DashboardProps {
  profile: StoreProfile
  activities: Activity[]
  onNavigate: (page: PageId) => void
  onActivity: (activity: Activity) => void
  onGuide: () => void
  onStaffGenderChange: (id: AssistantId, gender: StaffGender) => void
}

const actions = [
  { title: '지원 정책 찾기', button: '정책 알아보기' },
  { title: '가게 홍보하기', button: '카드뉴스 만들기' },
  { title: '리뷰 답글 작성하기', button: '리뷰 답글 만들기' },
  { title: '매출 분석하기', button: '매출 살펴보기' },
]

export default function Dashboard({ profile, activities, onNavigate, onActivity, onGuide, onStaffGenderChange }: DashboardProps) {
  const staffPreferences = useContext(StaffPreferencesContext)
  const recent = activities.filter((activity) => activity.createdAt).slice(0, 2)
  return (
    <div className="simple-dashboard">
      <div className="dashboard-intro">
        <span className="dashboard-store"><Store size={17} />{profile.name}<span>·</span>{profile.category}</span>
        <h1>사장님, 어떤 도움이 필요하세요?</h1>
        <p>필요한 일을 고르면, 비서가 차근차근 도와드릴게요.</p>
      </div>
      <section className="simple-assistant-grid" aria-label="우리 가게 비서 선택">
        {assistants.map(({ id, name }, index) => (
          <article className="simple-assistant-card" key={id}>
            <a className="simple-assistant-open" href={`#${id}`} onClick={(event) => { event.preventDefault(); onNavigate(id) }}>
              <StaffAvatar id={id} />
              <div className="simple-assistant-copy">
                <h2>{name}</h2>
                <p>{actions[index].title}</p>
                <span className="simple-assistant-action">{actions[index].button}<ArrowRight size={17} /></span>
              </div>
            </a>
            <div className="staff-gender-controls" role="group" aria-label={`${name} 스태프 성별`}>
              <span className="staff-gender-label">스태프 선택</span>
              <div className="staff-gender-options">
                <button type="button" aria-pressed={staffPreferences[id] === 'boy'} onClick={() => onStaffGenderChange(id, 'boy')}>남성</button>
                <button type="button" aria-pressed={staffPreferences[id] === 'girl'} onClick={() => onStaffGenderChange(id, 'girl')}>여성</button>
              </div>
            </div>
          </article>
        ))}
      </section>
      {recent.length > 0 && (
        <section className="simple-recent">
          <div className="section-heading"><h2>최근에 함께한 일</h2><button className="text-button" onClick={() => onNavigate('history')}>전체 보기<ChevronRight size={16} /></button></div>
          <div className="panel">
            {recent.map((activity) => {
              const assistant = getAssistant(activity.assistant)
              return <button className="simple-recent-row" key={activity.id} onClick={() => onActivity(activity)}><StaffAvatar id={activity.assistant} /><span><strong>{activity.title}</strong><small>{assistant.name}</small></span><ChevronRight size={18} /></button>
            })}
          </div>
        </section>
      )}
      <div className="dashboard-guide"><CircleHelp size={22} /><div><strong>처음 사용하시나요?</strong><p>가게비서 사용 방법을 쉽게 알려드릴게요.</p></div><button onClick={onGuide}>사용 방법 보기<ArrowRight size={16} /></button></div>
    </div>
  )
}
