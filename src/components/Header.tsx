import { CircleHelp, Search, Settings, Store } from 'lucide-react'
import type { StoreProfile } from '../types'
import './header.css'

interface HeaderProps {
  profile: StoreProfile
  onSearch: () => void
  onSettings: () => void
  onHome: () => void
  onHelp: () => void
  onSelectBusiness: () => void
}

export default function Header({ profile, onSearch, onSettings, onHome, onHelp, onSelectBusiness }: HeaderProps) {
  return (
    <header className="header">
      <button className="workspace-brand" onClick={onHome} aria-label="가게비서 홈"><Store size={28} strokeWidth={1.7} />가게비서<span>.</span></button>
      <button className="header-store" onClick={onSelectBusiness} aria-label={`${profile.name} 업종 변경`}><span>{profile.name}</span><small>업종 변경</small></button>
      <div className="header-actions">
        <button className="header-tool" onClick={onSearch} aria-label="작업 찾기"><Search size={19} /><span>작업 찾기</span></button>
        <button className="header-tool" onClick={onHelp} aria-label="사용 방법"><CircleHelp size={19} /><span>사용 방법</span></button>
        <button className="header-tool" onClick={onSettings} aria-label="가게 설정"><Settings size={19} /><span>가게 설정</span></button>
      </div>
    </header>
  )
}
