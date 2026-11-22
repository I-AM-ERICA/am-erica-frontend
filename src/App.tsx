import { ArrowRight, Copy, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Layout from './components/Layout'
import Modal from './components/Modal'
import StaffAvatar from './components/StaffAvatar'
import { defaultStaffPreferences, StaffPreferencesContext } from './services/staff'
import type { StaffGender, StaffPreferences } from './services/staff'
import { loadAccountSettings, saveStoreProfile, saveStaffPreference } from './services/account-settings'
import './pages/styles/account-settings.css'
import { assistants } from './data'
import Dashboard from './pages/Dashboard'
import AssistantPage from './pages/AssistantPage'
import PolicyChatPage from './pages/PolicyChatPage'
import MarketingPage from './pages/MarketingPage'
import SalesPage from './pages/SalesPage'
import { safeImageUrl, generateMarketing, reviseMarketing } from './services/marketing'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import LandingPage from './pages/LandingPage'
import BusinessSetupPage from './pages/BusinessSetupPage'
import Login from './pages/Login'
import { AUTH_CHANGED, getSessionExpiresAt, hasNaverCallback, initializeAuth, logout } from './services/auth'
import type { AuthUser } from './services/auth'
import { readRoute, resolveRoute } from './services/navigation'
import type { Activity, AppPage, AssistantId, StoreProfile } from './types'

const defaultProfile: StoreProfile = { name: '우리 가게', owner: '사장', category: '업종 미선택', region: '지역 미설정' }
function readLocal<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null'); return validate(value) ? value : fallback } catch { return fallback }
}
function isActivities(value: unknown): value is Activity[] { return Array.isArray(value) && value.every((item) => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.description === 'string' && typeof item.content === 'string' && typeof item.createdAt === 'string' && assistants.some((assistant) => assistant.id === item.assistant)) }

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [authError, setAuthError] = useState('')
  useEffect(() => {
    let active = true
    void initializeAuth().then((result) => {
      if (!active) return
      if (result.returnTo) window.history.replaceState(null, '', `${location.pathname}${location.search}#${result.returnTo}`)
      setUser(result.user)
      setAuthError(result.error ?? '')
      setChecking(false)
    })
    const onLogout = () => { setUser(null) }
    window.addEventListener(AUTH_CHANGED, onLogout)
    return () => { active = false; window.removeEventListener(AUTH_CHANGED, onLogout) }
  }, [])
  useEffect(() => {
    if (!user) return
    let timer: number
    const checkExpiry = () => {
      window.clearTimeout(timer)
      const remaining = (getSessionExpiresAt() ?? 0) - Date.now()
      if (remaining <= 0) { logout(); setAuthError('로그인이 만료되었어요. 다시 로그인해 주세요.') }
      else timer = window.setTimeout(checkExpiry, Math.min(remaining, 2147483647))
    }
    checkExpiry()
    window.addEventListener('focus', checkExpiry)
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', checkExpiry) }
  }, [user])
  return <Application key={`${checking ? 'checking' : 'ready'}-${user?.id ?? 'guest'}`} user={user} checking={checking} authError={authError} onAuthenticated={(next) => { setAuthError(''); setUser(next) }} />
}

function Application({ user, checking, authError, onAuthenticated }: { user: AuthUser | null; checking: boolean; authError: string; onAuthenticated: (user: AuthUser) => void }) {
  const storageKey = (key: string) => `${key}:${user?.id ?? 'guest'}`
  const [requestedPage, setPage] = useState<AppPage>(() => hasNaverCallback() ? 'login' : readRoute(location.hash))
  const [hasStore, setHasStore] = useState(false)
  const page = resolveRoute(requestedPage, hasStore, !!user)
  const [profile, setProfile] = useState<StoreProfile>({ ...defaultProfile, owner: user?.name || defaultProfile.owner })
  const [staffPreferences, setStaffPreferences] = useState<StaffPreferences>(defaultStaffPreferences)
  const [activities, setActivities] = useState(() => readLocal(storageKey('gage-activities'), [], isActivities))
  const [accountStatus, setAccountStatus] = useState<'loading' | 'ready' | 'error'>(user ? 'loading' : 'ready')
  const [accountReload, setAccountReload] = useState(0)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const savingRef = useRef(false)
  const settingsRequest = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; settingsRequest.current?.abort() }
  }, [])
  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    let active = true
    setAccountStatus('loading')
    loadAccountSettings(controller.signal).then((data) => {
      if (!active) return
      setHasStore(!!data.store)
      setProfile(data.store || { ...defaultProfile, owner: user.name || defaultProfile.owner })
      setStaffPreferences(data.staffPreferences)
      setAccountStatus('ready')
      // A returning login should not repeat onboarding; later explicit industry changes still open setup.
      if (data.store) {
        setPage((current) => current === 'setup' ? 'dashboard' : current)
        if (location.hash === '#setup') window.history.replaceState(null, '', `${location.pathname}${location.search}#dashboard`)
      }
    }).catch(() => { if (active) setAccountStatus('error') })
    return () => { active = false; controller.abort() }
  }, [user, accountReload])
  const [modal, setModal] = useState<'help' | 'search' | Activity | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const notify = useCallback((message: string) => { setToast(message); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 3500) }, [])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  useEffect(() => { const handler = () => { setPage(readRoute(location.hash)); setModal(null); window.scrollTo({ top: 0 }) }; window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler) }, [])
  useEffect(() => { document.title = page === 'intro' ? '가게비서 | 혼자 하던 가게 운영, 이제 함께해요' : page === 'login' ? '로그인 | 가게비서' : page === 'setup' ? '우리 가게 선택 | 가게비서' : '우리 가게 비서 | 가게비서' }, [page])
  const navigate = (next: AppPage) => { location.hash = next; setPage(next); window.scrollTo({ top: 0 }); setModal(null) }
  const saveLocal = (key: string, value: unknown) => { try { localStorage.setItem(storageKey(key), JSON.stringify(value)); return true } catch { notify('브라우저 저장 공간을 사용할 수 없어요. 이번 방문 중에만 유지됩니다.'); return false } }
  const saveActivity = (activity: Activity) => { const next = [activity, ...activities].slice(0, 50); setActivities(next); saveLocal('gage-activities', next) }
  const changeStaffGender = async (id: AssistantId, gender: StaffGender) => {
    if (savingRef.current || accountStatus !== 'ready' || staffPreferences[id] === gender) return
    savingRef.current = true; setSettingsSaving(true)
    const controller = new AbortController(); settingsRequest.current = controller
    try {
      const next = await saveStaffPreference(id, gender, controller.signal)
      if (mounted.current) { setStaffPreferences(next); notify('비서 선택을 계정에 저장했어요.') }
    } catch {
      if (mounted.current) notify('비서 선택을 저장하지 못했어요. 다시 선택해 주세요.')
    } finally { savingRef.current = false; if (mounted.current) setSettingsSaving(false) }
  }
  const persistProfile = async (next: StoreProfile) => {
    if (savingRef.current || accountStatus !== 'ready') throw new Error('저장 중이에요. 잠시 후 다시 시도해 주세요.')
    savingRef.current = true; setSettingsSaving(true)
    const controller = new AbortController(); settingsRequest.current = controller
    try {
      const saved = await saveStoreProfile(next, controller.signal)
      if (!mounted.current) throw new Error('화면을 벗어나 저장 결과를 확인하지 못했어요.')
      setProfile(saved.store!); setHasStore(true); setStaffPreferences(saved.staffPreferences)
    } finally { savingRef.current = false; if (mounted.current) setSettingsSaving(false) }
  }
  const openSearch = () => { setSearch(''); setModal('search') }
  const searchTerm = search.trim().toLowerCase()
  const searchAssistants = assistants.filter((item) => `${item.name} ${item.title} ${item.tag} ${item.description}`.toLowerCase().includes(searchTerm))
  const searchActivities = activities.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(searchTerm)).slice(0, 5)
  const completeSetup = async (next: StoreProfile) => {
    await persistProfile(next)
    navigate('dashboard')
  }
  if (user && accountStatus !== 'ready' && requestedPage !== 'intro') return <main className="account-settings-status" aria-busy={accountStatus === 'loading'}>
    <h1>{accountStatus === 'loading' ? '우리 가게 정보를 불러오고 있어요' : '저장된 정보를 불러오지 못했어요'}</h1>
    <p>{accountStatus === 'loading' ? '계정에 저장된 매장과 비서 선택을 확인하고 있어요.' : '연결을 확인한 뒤 다시 시도해 주세요. 저장된 정보를 확인한 후 계속할 수 있어요.'}</p>
    {accountStatus === 'error' && <button className="primary-button" onClick={() => setAccountReload((value) => value + 1)}>다시 불러오기</button>}
    <button className="text-button" onClick={() => navigate('intro')}>서비스 소개로 돌아가기</button>
  </main>
  return <StaffPreferencesContext.Provider value={staffPreferences}>
    {page === 'intro' ? <LandingPage hasStore={hasStore} userName={user?.name} checking={checking} onLogin={() => navigate('login')} onLogout={() => { navigate('intro'); logout() }} onStart={() => navigate(hasStore ? 'dashboard' : 'setup')} onResume={() => navigate('dashboard')} /> : page === 'login' ? <Login onAuthenticated={onAuthenticated} onBack={() => navigate('intro')} returnTo={requestedPage === 'login' || requestedPage === 'intro' ? (hasStore ? 'dashboard' : 'setup') : requestedPage} checking={checking} error={authError} /> : page === 'setup' ? <BusinessSetupPage profile={profile} hasStore={hasStore} onBack={() => navigate('intro')} onComplete={completeSetup} /> : <Layout page={page} onNavigate={navigate} profile={profile} onSearch={openSearch} onHelp={() => setModal('help')} onSelectBusiness={() => navigate('setup')} onIntroduction={() => navigate('intro')}>
      {page === 'dashboard' ? <Dashboard profile={profile} activities={activities} onNavigate={navigate} onActivity={setModal} onGuide={() => setModal('help')} onStaffGenderChange={changeStaffGender} staffSaving={settingsSaving} /> : page === 'history' ? <HistoryPage activities={activities} onOpen={setModal} /> : page === 'settings' ? <SettingsPage key={profile.id} profile={profile} onSave={async (next) => { await persistProfile(next); notify('가게 정보를 계정에 저장했어요.') }} /> : page === 'policy' ? <PolicyChatPage key={JSON.stringify([profile.name, profile.category, profile.region, profile.ownerAge, profile.employeeCount, profile.monthlyRevenue])} profile={profile} onBack={() => navigate('dashboard')} onSave={saveActivity} onToast={notify} /> : page === 'marketing' ? <MarketingPage key={JSON.stringify(profile)} profile={profile} onGenerate={generateMarketing} onRevise={reviseMarketing} onBack={() => navigate('dashboard')} onSave={saveActivity} onToast={notify} /> : page === 'sales' ? <SalesPage key={profile.id} user={user} profile={profile} onBack={() => navigate('dashboard')} onSave={saveActivity} onToast={notify} /> : <AssistantPage key={page} id={page} profile={profile} onBack={() => navigate('dashboard')} onSave={saveActivity} onToast={notify} />}
    </Layout>}
    {modal === 'help' && <Modal title="사장님 곁의 네 명의 비서를 소개해요" onClose={() => setModal(null)}><p className="guide-intro">처음이라도 괜찮아요. 필요한 비서를 선택하고, 도움이 필요한 내용을 편하게 적어 주세요.</p>{assistants.map(({ id, name, description }) => <div className="guide-item" key={id}><StaffAvatar id={id} /><div><h3><button onClick={() => navigate(id)}>{name} <ArrowRight size={11} /></button></h3><p>{description.replace('\n', ' ')}</p></div></div>)}<div className="guide-note">체험 모드에서는 예시 템플릿을 제공합니다. 홍보 비서는 참고 이미지와 글귀로 카드뉴스를 제작합니다. 고객 답변은 자동으로 발송되지 않습니다. 생성한 작업은 이용 내역에서 다시 확인할 수 있어요.</div><div className="modal-actions"><button className="primary-button" onClick={() => navigate('policy')}>정책 비서부터 만나보기<ArrowRight size={14} /></button></div></Modal>}
    {modal === 'search' && <Modal title="어떤 도움이 필요하세요?" onClose={() => setModal(null)}><input autoFocus className="search-input" aria-label="비서와 작업 검색" placeholder="정책, 카드뉴스, 리뷰, 매출 등을 검색해 보세요" value={search} onChange={(event) => setSearch(event.target.value)} /><p className="search-section-label">우리 가게 비서</p>{searchAssistants.map(({ id, name, tag }) => <button className="search-result" key={id} onClick={() => navigate(id)}><StaffAvatar id={id} /><span><strong>{name}</strong><small>{tag}</small></span></button>)}{searchActivities.length > 0 && <p className="search-section-label">최근 작업</p>}{searchActivities.map((activity) => <button className="search-result" key={activity.id} onClick={() => setModal(activity)}><Search size={17} /><span><strong>{activity.title}</strong><small>{activity.description}</small></span></button>)}{searchAssistants.length === 0 && searchActivities.length === 0 && <p className="empty-state">검색 결과가 없어요. 다른 단어로 찾아보세요.</p>}</Modal>}
    {modal && typeof modal === 'object' && <Modal title={modal.title} onClose={() => setModal(null)}><p className="guide-intro">{modal.description} · {modal.createdAt ? new Date(modal.createdAt).toLocaleString('ko-KR') : '화면 체험용 예시'}</p>{modal.imageUrl && safeImageUrl(modal.imageUrl) && <a href={safeImageUrl(modal.imageUrl)!} target="_blank" rel="noreferrer"><img className="activity-marketing-image" src={safeImageUrl(modal.imageUrl)!} alt="생성한 카드뉴스" /></a>}<pre className="activity-content">{modal.content}</pre><div className="modal-actions"><button className="secondary-button" onClick={async () => { try { await navigator.clipboard.writeText(modal.content); notify('내용을 복사했어요.') } catch { notify('복사 권한을 확인해 주세요.') } }}><Copy size={14} />내용 복사</button><button className="primary-button" onClick={() => navigate(modal.assistant)}>이 비서와 새 작업<ArrowRight size={14} /></button></div></Modal>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </StaffPreferencesContext.Provider>
}
