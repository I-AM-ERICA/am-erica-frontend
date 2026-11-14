import { useContext, useState } from 'react'
import { getAssistant } from '../data'
import { getStaffImageUrl, StaffPreferencesContext } from '../services/staff'
import type { AssistantId } from '../types'
import '../pages/styles/staff.css'

export default function StaffAvatar({ id, className = '' }: { id: AssistantId; className?: string }) {
  const preferences = useContext(StaffPreferencesContext)
  const { name, color, icon: Icon } = getAssistant(id)
  const gender = preferences[id]
  const src = getStaffImageUrl(id, gender)
  const [failedSrc, setFailedSrc] = useState('')
  const label = `${name} ${gender === 'boy' ? '남성' : '여성'} 스태프`
  return <span className={`assistant-icon staff-avatar ${color} ${className}`}>
    {failedSrc === src
      ? <span className="staff-avatar-fallback" role="img" aria-label={`${label} 이미지 없음`} title="이미지를 불러오지 못해 기본 아이콘을 표시합니다."><Icon size={28} aria-hidden="true" /></span>
      : <img key={src} src={src} alt={label} loading="lazy" decoding="async" onLoad={() => setFailedSrc('')} onError={() => setFailedSrc(src)} />}
  </span>
}
