import { ArrowDown, ArrowRight, Check, Store } from 'lucide-react'
import { assistants } from '../data'
import Footer from '../components/Footer'
import StaffAvatar from '../components/StaffAvatar'
import './styles/landing.css'

interface LandingPageProps {
  onStart: () => void
  onResume: () => void
  onLogin: () => void
  onLogout: () => void
  hasStore: boolean
  userName?: string
  checking?: boolean
}

export default function LandingPage({ onStart, onResume, onLogin, onLogout, hasStore, userName, checking }: LandingPageProps) {
  return (
    <div className="landing-page">
      <header className="public-header">
        <a className="public-brand" href="#intro" aria-label="가게비서 홈"><Store size={29} strokeWidth={1.7} />가게비서<span>.</span></a>
        <nav aria-label="서비스 안내"><a href="#service-introduction" onClick={(event) => { event.preventDefault(); document.getElementById('service-introduction')?.scrollIntoView({ behavior: 'smooth' }) }}>서비스 소개</a><a href="#how-to-start" onClick={(event) => { event.preventDefault(); document.getElementById('how-to-start')?.scrollIntoView({ behavior: 'smooth' }) }}>이용 방법</a></nav>
        <div className="public-actions">
          {userName !== undefined ? <><span className="public-user">{userName}님</span><button className="public-login" onClick={onLogout}>로그아웃</button></> : <button className="public-login" onClick={onLogin} disabled={checking}>{checking ? '확인 중…' : '로그인'}</button>}
        <button className="public-start" onClick={hasStore ? onResume : onStart}>{hasStore ? '내 가게로 가기' : '시작하기'}<ArrowRight size={17} /></button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <p className="landing-eyebrow"><span />사장님 곁에, 가게비서</p>
          <h1>혼자 하던 가게 운영,<br /><em>이제 함께해요.</em></h1>
          <p className="landing-lead">지원 정책 찾기부터 홍보, 고객 응대, 매출 정리까지.<br />사장님의 바쁜 하루에 든든한 비서를 더해 보세요.</p>
          <button className="landing-cta" onClick={onStart}>우리 가게 비서 시작하기<ArrowRight size={21} /></button>
          <p className="hero-reassurance">네이버로 로그인하고, 업종을 고르면 시작할 수 있어요.</p>

          <div className="landing-preview" aria-label="가게비서 이용 화면 예시">
            <div className="preview-top"><span><Store size={18} />가게비서</span><span className="preview-tag">이렇게 도와드려요</span></div>
            <div className="preview-body"><div className="preview-intro"><span>오늘은 어떤 일이 필요하세요?</span><h2>가게에 필요한 일,<br />비서에게 맡겨 보세요.</h2><p>복잡한 메뉴 없이<br />필요한 일을 골라 시작해요.</p></div><div className="preview-choices">{assistants.map(({ id, name }, index) => <div key={id} className="preview-choice"><StaffAvatar id={id} /><div><strong>{['지원 정책 알아보기', '가게 홍보 준비하기', '리뷰 답글 작성하기', '매출 흐름 살펴보기'][index]}</strong><span>{name}</span></div><ArrowRight size={17} /></div>)}</div></div>
          </div>
          <a className="landing-scroll" href="#service-introduction" onClick={(event) => { event.preventDefault(); document.getElementById('service-introduction')?.scrollIntoView({ behavior: 'smooth' }) }}>가게비서 자세히 알아보기<ArrowDown size={15} /></a>
        </section>

        <section className="landing-services" id="service-introduction">
          <div className="landing-section-heading"><p className="landing-eyebrow">사장님의 일을 나누는 네 명의 비서</p><h2>잘하고 싶은 마음은 그대로.<br />번거로운 일은 조금 가볍게.</h2><p>필요할 때, 필요한 일만 골라 도움받으세요.</p></div>
          <div className="service-list">{assistants.map(({ id, name }, index) => <article key={id}><StaffAvatar id={id} /><div><span className="service-label">{name}</span><h3>{['복잡한 지원 정책, 쉽게 찾아보세요.', '우리 가게 소식, 더 쉽게 전하세요.', '바쁜 날에도, 정성스러운 리뷰 답글을.', '쌓여 있는 매출, 알기 쉽게 정리해요.'][index]}</h3><p>{['가게 상황에 맞는 정책을 찾고, 준비할 내용을 확인해요.', '참고 이미지와 글귀로 우리 가게 카드뉴스를 만들어요.', '고객 리뷰를 넣으면 정성스러운 답글 초안을 준비해 드려요.', '매출 파일을 넣고 합계와 시간대별 흐름을 확인해요.'][index]}</p></div></article>)}</div>
        </section>

        <section className="landing-how" id="how-to-start"><div className="landing-section-heading"><p className="landing-eyebrow">시작은 간단하게</p><h2>딱 세 번의 선택이면 충분해요.</h2></div><ol><li><span>01</span><h3>우리 가게 업종 고르기</h3><p>카페, 음식점, 소매점 등<br />가게에 맞는 업종을 선택해요.</p></li><li><span>02</span><h3>필요한 비서 선택하기</h3><p>오늘 도움받고 싶은 일을<br />네 가지 중에서 골라요.</p></li><li><span>03</span><h3>내용을 넣고 결과 확인하기</h3><p>완성된 내용을 확인하고<br />우리 가게에 맞게 다듬어 써요.</p></li></ol><button className="landing-cta" onClick={onStart}>지금 시작하기<ArrowRight size={20} /></button><p className="landing-demo-note"><Check size={15} />현재 체험 모드로 둘러볼 수 있어요. 실제 AI 기능은 연결 준비 중입니다.</p></section>
      </main>
      <div className="public-footer"><Footer /></div>
    </div>
  )
}
