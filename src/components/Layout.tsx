import { BookOpen, History, LayoutGrid } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PageId, StoreProfile } from '../types'
import Header from './Header'
import Footer from './Footer'
import './layout.css'

interface LayoutProps {
  children: ReactNode
  page: PageId
  onNavigate: (page: PageId) => void
  profile: StoreProfile
  onSearch: () => void
  onHelp: () => void
  onSelectBusiness: () => void
  onIntroduction: () => void
}

export default function Layout({ children, page, onNavigate, profile, onSearch, onHelp, onSelectBusiness, onIntroduction }: LayoutProps) {
  return (
    <div className="app-shell">
      <Header profile={profile} onSearch={onSearch} onSettings={() => onNavigate('settings')} onHome={() => onNavigate('dashboard')} onHelp={onHelp} onSelectBusiness={onSelectBusiness} />
      <div className="workspace-nav-wrap"><nav className="workspace-nav" aria-label="가게비서 메뉴">
        <button className={page === 'dashboard' ? 'active' : ''} aria-current={page === 'dashboard' ? 'page' : undefined} onClick={() => onNavigate('dashboard')}><LayoutGrid size={18} />비서 선택</button>
        <button className={page === 'history' ? 'active' : ''} aria-current={page === 'history' ? 'page' : undefined} onClick={() => onNavigate('history')}><History size={18} />이용 내역</button>
        <button className="introduction-link" onClick={onIntroduction}><BookOpen size={16} />서비스 소개</button>
      </nav></div>
      <div className="main-content"><main key={page}>{children}</main><Footer /></div>
    </div>
  )
}
