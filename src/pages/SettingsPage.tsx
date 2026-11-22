import { Save, Search, Store } from 'lucide-react'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { StoreProfile } from '../types'
import { isLiveMode } from '../services/assistant'
import StoreInfoField from '../components/StoreInfoField'
import { getStoreInfo, clearLegacyStoreInfo } from '../services/store-info'
import AddressSearchDialog from '../components/AddressSearchDialog'

export default function SettingsPage({ profile, onSave }: { profile: StoreProfile; onSave: (profile: StoreProfile) => void | Promise<void> }) {
  const [draft, setDraft] = useState(() => ({ ...profile, storeInfo: getStoreInfo(profile) }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const addressButton = useRef<HTMLButtonElement>(null)
  const closeSearch = () => { setSearchOpen(false); addressButton.current?.focus() }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true); setError('')
    try { await onSave({ ...draft, storeInfo: draft.storeInfo.trim(), name: draft.name.trim(), owner: draft.owner.trim(), category: draft.category.trim(), region: draft.region.trim() }); clearLegacyStoreInfo(profile) }
    catch (cause) { setError(cause instanceof Error && cause.name !== 'TypeError' ? cause.message : '가게 정보를 저장하지 못했어요. 다시 시도해 주세요.') }
    finally { setSaving(false) }
  }
  return <>
    <div className="page-heading"><p className="eyebrow">우리 가게를 조금 더 알려 주세요</p><h1>가게 설정</h1><p>비서들이 사장님의 가게를 이해할 수 있도록 기본 정보를 입력해 주세요.</p></div>
    <div className="settings-grid">
      <form className="panel settings-form" onSubmit={submit} aria-busy={saving}>
        <div className="section-heading"><h2>우리 가게 정보</h2><Store size={19} /></div>
        {([{ key: 'name', label: '가게 이름', placeholder: '예: 오후의 커피' }, { key: 'owner', label: '사장님 이름', placeholder: '예: 김가게' }, { key: 'category', label: '업종', placeholder: '예: 카페, 음식점, 소매점' }] as const).map((field) => <div key={field.key}>
          <label htmlFor={`store-${field.key}`}>{field.label}</label>
          <input id={`store-${field.key}`} value={draft[field.key]} placeholder={field.placeholder} required maxLength={40} pattern=".*\S.*" disabled={saving} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })} />
        </div>)}
        <div>
          <label htmlFor="store-address">가게 소재지</label>
          <div className="store-address-row">
            <input id="store-address" value={draft.address || (draft.region === '지역 미설정' ? '' : draft.region)}
              placeholder="주소 검색으로 가게 주소를 선택해 주세요" readOnly disabled={saving}
              aria-describedby="store-address-help" aria-haspopup="dialog" onClick={() => setSearchOpen(true)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSearchOpen(true) } }} />
            <button ref={addressButton} type="button" className="store-address-button" disabled={saving} aria-haspopup="dialog" onClick={() => setSearchOpen(true)}><Search size={16} />주소 검색</button>
          </div>
          <p className="input-caption" id="store-address-help">도로명이나 건물명으로 검색해 선택한 뒤, 가게 정보를 저장해 주세요.</p>
        </div>
        <StoreInfoField value={draft.storeInfo} onChange={storeInfo => setDraft({ ...draft, storeInfo })} disabled={saving} />
        {profile.storeInfo == null && getStoreInfo(profile) && <p className="input-caption">이 브라우저에 작성했던 가게 정보를 불러왔어요. 아래 저장 버튼을 누르면 계정에 보관돼요.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={saving}><Save size={15} />{saving ? '계정에 저장 중' : '가게 정보 저장'}</button>
        <p className="input-caption">정보는 계정에 저장되어 다른 기기에서도 불러올 수 있어요.</p>
      </form>
      <div className="panel settings-info"><h2>비서 연결 상태</h2><span className="connection-state"><i />{isLiveMode ? '백엔드 연결 모드' : '체험 모드'}</span><p>{isLiveMode ? '각 비서의 요청을 연결된 백엔드로 전달합니다. 실제 연결 상태는 요청 시 확인합니다.' : '지금은 예시 템플릿과 데이터로 일부 비서를 체험할 수 있어요. 입력한 매출 CSV의 합계와 피크타임은 실제로 계산합니다.'}</p><p>정책 공고의 자격과 접수 기한은 반드시 공식 안내를 확인해 주세요. 고객 답변과 홍보 문안은 직접 검토하고 사용해 주세요.</p></div>
    </div>
    {searchOpen && <AddressSearchDialog onClose={closeSearch} onSelect={(value) => {
      setDraft((current) => ({ ...current, ...value })); setError(''); closeSearch()
    }} />}
  </>
}
