import { ArrowRight, Copy, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Layout from './components/Layout'
import Modal from './components/Modal'
import { assistants } from './data'
import Dashboard from './pages/Dashboard'
import AssistantPage from './pages/AssistantPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import LandingPage from './pages/LandingPage'
import BusinessSetupPage from './pages/BusinessSetupPage'
import { readRoute, resolveRoute } from './services/navigation'
import type { Activity, AppPage, StoreProfile } from './types'

const defaultProfile: StoreProfile = { name: '우리 가게', owner: '사장', category: '업종 미선택', region: '지역 미설정' }
function readLocal<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null'); return validate(value) ? value : fallback } catch { return fallback }
}
function isProfile(value: unknown): value is StoreProfile { return !!value && typeof value === 'object' && ['name', 'owner', 'category', 'region'].every((key) => key in value && typeof (value as Record<string, unknown>)[key] === 'string' && ((value as Record<string, string>)[key].trim().length > 0)) }
function isActivities(value: unknown): value is Activity[] { return Array.isArray(value) && value.every((item) => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.description === 'string' && typeof item.content === 'string' && typeof item.createdAt === 'string' && assistants.some((assistant) => assistant.id === item.assistant)) }

export default function App() {
  const [requestedPage, setPage] = useState<AppPage>(() => readRoute(location.hash))
  const [hasStore, setHasStore] = useState(() => readLocal('gage-onboarded', false, (value): value is boolean => typeof value === 'boolean'))
  const page = resolveRoute(requestedPage, hasStore)
  const [profile, setProfile] = useState(() => readLocal('gage-profile', defaultProfile, isProfile))
  const [activities, setActivities] = useState(() => readLocal('gage-activities', [], isActivities))
  const [modal, setModal] = useState<'help' | 'search' | Activity | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const notify = useCallback((message: string) => { setToast(message); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 3500) }, [])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  useEffect(() => { const handler = () => { setPage(readRoute(location.hash)); setModal(null); window.scrollTo({ top: 0 }) }; window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler) }, [])
  useEffect(() => { document.title = page === 'intro' ? '가게비서 | 혼자 하던 가게 운영, 이제 함께해요' : page === 'setup' ? '우리 가게 선택 | 가게비서' : '우리 가게 비서 | 가게비서' }, [page])
  const navigate = (next: AppPage) => { location.hash = next; setPage(next); window.scrollTo({ top: 0 }); setModal(null) }
  const saveLocal = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { notify('브라우저 저장 공간을 사용할 수 없어요. 이번 방문 중에만 유지됩니다.'); return false } }
  const saveActivity = (activity: Activity) => { const next = [activity, ...activities].slice(0, 50); setActivities(next); saveLocal('gage-activities', next) }
  const openSearch = () => { setSearch(''); setModal('search') }
  const searchTerm = search.trim().toLowerCase()
  const searchAssistants = assistants.filter((item) => `${item.name} ${item.title} ${item.tag} ${item.description}`.toLowerCase().includes(searchTerm))
  const searchActivities = activities.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(searchTerm)).slice(0, 5)
  const completeSetup = (next: StoreProfile) => {
    setProfile(next)
    setHasStore(true)
    if (saveLocal('gage-profile', next)) saveLocal('gage-onboarded', true)
    navigate('dashboard')
  }
  return <>
    {page === 'intro' ? <LandingPage hasStore={hasStore} onStart={() => navigate('setup')} onResume={() => navigate('dashboard')} /> : page === 'setup' ? <BusinessSetupPage profile={profile} hasStore={hasStore} onBack={() => navigate('intro')} onComplete={completeSetup} /> : <Layout page={page} onNavigate={navigate} profile={profile} onSearch={openSearch} onHelp={() => setModal('help')} onSelectBusiness={() => navigate('setup')} onIntroduction={() => navigate('intro')}>
      {page === 'dashboard' ? <Dashboard profile={profile} activities={activities} onNavigate={navigate} onActivity={setModal} onGuide={() => setModal('help')} /> : page === 'history' ? <HistoryPage activities={activities} onOpen={setModal} /> : page === 'settings' ? <SettingsPage profile={profile} onSave={(next) => { setProfile(next); if (saveLocal('gage-profile', next)) notify('가게 정보를 저장했어요.') }} /> : <AssistantPage key={page} id={page} profile={profile} onBack={() => navigate('dashboard')} onSave={saveActivity} onToast={notify} />}
    </Layout>}
    {modal === 'help' && <Modal title="사장님 곁의 네 명의 비서를 소개해요" onClose={() => setModal(null)}><p className="guide-intro">처음이라도 괜찮아요. 필요한 비서를 선택하고, 도움이 필요한 내용을 편하게 적어 주세요.</p>{assistants.map(({ id, name, description, icon: Icon, color }) => <div className="guide-item" key={id}><span className={`assistant-icon ${color}`}><Icon size={20} /></span><div><h3><button onClick={() => navigate(id)}>{name} <ArrowRight size={11} /></button></h3><p>{description.replace('\n', ' ')}</p></div></div>)}<div className="guide-note">체험 모드에서는 예시 템플릿을 제공합니다. 홍보 비서는 문안과 영상 기획을 만들며 이미지·영상 파일은 생성하지 않습니다. 고객 답변은 자동으로 발송되지 않습니다. 생성한 작업은 이용 내역에서 다시 확인할 수 있어요.</div><div className="modal-actions"><button className="primary-button" onClick={() => navigate('policy')}>정책 비서부터 만나보기<ArrowRight size={14} /></button></div></Modal>}
    {modal === 'search' && <Modal title="어떤 도움이 필요하세요?" onClose={() => setModal(null)}><input autoFocus className="search-input" aria-label="비서와 작업 검색" placeholder="정책, 카드뉴스, 리뷰, 매출 등을 검색해 보세요" value={search} onChange={(event) => setSearch(event.target.value)} /><p className="search-section-label">우리 가게 비서</p>{searchAssistants.map(({ id, name, tag, icon: Icon, color }) => <button className="search-result" key={id} onClick={() => navigate(id)}><span className={`assistant-icon ${color}`}><Icon size={19} /></span><span><strong>{name}</strong><small>{tag}</small></span></button>)}{searchActivities.length > 0 && <p className="search-section-label">최근 작업</p>}{searchActivities.map((activity) => <button className="search-result" key={activity.id} onClick={() => setModal(activity)}><Search size={17} /><span><strong>{activity.title}</strong><small>{activity.description}</small></span></button>)}{searchAssistants.length === 0 && searchActivities.length === 0 && <p className="empty-state">검색 결과가 없어요. 다른 단어로 찾아보세요.</p>}</Modal>}
    {modal && typeof modal === 'object' && <Modal title={modal.title} onClose={() => setModal(null)}><p className="guide-intro">{modal.description} · {modal.createdAt ? new Date(modal.createdAt).toLocaleString('ko-KR') : '화면 체험용 예시'}</p><pre className="activity-content">{modal.content}</pre><div className="modal-actions"><button className="secondary-button" onClick={async () => { try { await navigator.clipboard.writeText(modal.content); notify('내용을 복사했어요.') } catch { notify('복사 권한을 확인해 주세요.') } }}><Copy size={14} />내용 복사</button><button className="primary-button" onClick={() => navigate(modal.assistant)}>이 비서와 새 작업<ArrowRight size={14} /></button></div></Modal>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </>
}
