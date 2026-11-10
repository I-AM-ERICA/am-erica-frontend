import { ArrowLeft, ArrowRight, Check, Coffee, Flower2, Scissors, ShoppingBag, ShoppingBasket, Store, UtensilsCrossed, BedDouble } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { StoreProfile } from '../types'
import './business-setup.css'

const categories = [
  { name: '카페·베이커리', icon: Coffee, note: '커피 한 잔의 여유를 파는 곳', short: '오늘도, 따뜻한 한 잔', className: 'cafe' },
  { name: '음식점', icon: UtensilsCrossed, note: '정성 가득한 한 끼를 만드는 곳', short: '정성을 담은 한 끼', className: 'restaurant' },
  { name: '소매·편의점', icon: ShoppingBasket, note: '이웃의 일상을 채워 주는 곳', short: '우리 동네 작은 상점', className: 'retail' },
  { name: '온라인 쇼핑몰', icon: ShoppingBag, note: '좋은 물건을 더 많은 사람에게', short: '취향을 담은 물건들', className: 'online' },
  { name: '미용·뷰티', icon: Scissors, note: '누군가의 하루를 아름답게', short: '기분 좋은 변화의 시작', className: 'beauty' },
  { name: '숙박', icon: BedDouble, note: '편안한 쉼을 준비하는 곳', short: '하루를 쉬어 가는 곳', className: 'stay' },
  { name: '생활 서비스', icon: Flower2, note: '이웃 곁에서 힘이 되는 곳', short: '일상에 작은 보탬', className: 'service' },
  { name: '기타', icon: Store, note: '어떤 가게든, 함께할게요', short: '모든 가게의 가능성', className: 'other' },
]

export default function BusinessSetupPage({ profile, hasStore, onBack, onComplete }: { profile: StoreProfile; hasStore: boolean; onBack: () => void; onComplete: (profile: StoreProfile) => void }) {
  const [category, setCategory] = useState(hasStore ? profile.category : '')
  const [name, setName] = useState(hasStore ? profile.name : '')
  const selected = categories.find((item) => item.name === category)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    onComplete({ ...profile, category: selected.name, name: name.trim() || (hasStore ? profile.name : '우리 가게') })
  }

  return <div className="setup-page">
    <header className="setup-header"><button className="setup-back" onClick={onBack} aria-label="서비스 소개로 돌아가기"><ArrowLeft size={21} /></button><a className="public-brand" href="#intro"><Store size={28} strokeWidth={1.7} />가게비서<span>.</span></a><span className="setup-step">우리 가게 알아가기</span></header>
    <main className="setup-main"><form className="setup-card" onSubmit={submit}>
      <p className="setup-eyebrow">사장님, 반가워요.</p>
      <h1>어떤 가게를<br />운영하고 계신가요?</h1>
      <p className="setup-description">가게에 맞는 업종을 하나 골라 주세요.<br />선택한 정보는 나중에 바꿀 수 있어요.</p>
      <fieldset className="business-options"><legend className="visually-hidden">가게 업종 선택</legend>{categories.map(({ name: option, icon: Icon }) => <label className={`business-option ${category === option ? 'selected' : ''}`} key={option}><input type="radio" name="business-category" value={option} checked={category === option} onChange={() => setCategory(option)} /><Icon size={20} /><span>{option}</span>{category === option && <Check size={17} className="option-check" />}</label>)}</fieldset>
      <label className="business-name-label" htmlFor="business-name">가게 이름 <span>선택</span></label>
      <input id="business-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="예: 오후의 커피" />
      <button className="setup-continue" type="submit" disabled={!selected}>선택하고 비서 만나기<ArrowRight size={19} /></button>
      <p className="setup-storage-note">입력한 정보는 이 브라우저에 저장돼요.</p>
    </form>
    <aside className="setup-visual" aria-label="다양한 업종의 가게를 위한 서비스"><p className="setup-visual-intro">가게의 모습은 달라도,<br /><strong>사장님의 마음은 같으니까.</strong></p><div className="shop-mosaic" aria-hidden="true">{[categories[0], categories[1], categories[4], categories[2]].map(({ name: option, icon: Icon, short, className }) => <div className={`shop-poster poster-${className} ${category === option ? 'highlighted' : ''}`} key={option}><span className="poster-category">{option}</span><strong>{short}</strong><div className="poster-shop"><div className="poster-roof" /><div className="poster-awning"><i /><i /><i /><i /><i /></div><div className="poster-window"><Icon size={36} strokeWidth={1.25} /></div><div className="poster-door" /></div><span className="poster-caption">사장님 곁에, 가게비서</span></div>)}</div><p className="setup-visual-note" aria-live="polite">{selected ? `${selected.note}. 가게비서가 함께할게요.` : '작은 가게의 든든한 운영 파트너'}</p></aside>
    </main>
  </div>
}
