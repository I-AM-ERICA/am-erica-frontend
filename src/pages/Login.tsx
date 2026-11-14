import { ArrowLeft, ShieldCheck, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import Footer from '../components/Footer'
import { startNaverLogin } from '../services/auth'
import type { AppPage } from '../types'
import './styles/login.css'

interface LoginProps {
  onBack: () => void
  returnTo: AppPage
  checking?: boolean
  error?: string
}

export default function Login({ onBack, returnTo, checking = false, error = '' }: LoginProps) {
  const [pending, setPending] = useState(false)
  const [loginError, setLoginError] = useState('')
  useEffect(() => {
    const onPageShow = () => setPending(false)
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])
  const handleLogin = () => {
    setLoginError('')
    setPending(true)
    try { startNaverLogin(returnTo) } catch (cause) {
      setPending(false)
      setLoginError(cause instanceof Error ? cause.message : '로그인을 시작하지 못했어요. 다시 시도해 주세요.')
    }
  }
  return <div className="login-page">
    <header className="login-header">
      <a className="login-brand" href="#intro" aria-label="가게비서 홈"><Store size={28} strokeWidth={1.7} />가게비서<span>.</span></a>
      <button className="login-back" onClick={onBack}><ArrowLeft size={16} />처음으로</button>
    </header>
    <main className="login-main">
      <section className="login-card" aria-labelledby="login-title" aria-busy={checking || pending}>
        <div className="login-symbol"><Store size={34} strokeWidth={1.5} /></div>
        <p className="login-eyebrow">사장님 곁에, 가게비서</p>
        <h1 id="login-title">반가워요, 사장님.</h1>
        <p className="login-description">네이버 계정으로 간편하게 로그인하고<br />우리 가게에 필요한 비서를 만나보세요.</p>
        <button className="naver-login-button" onClick={handleLogin} disabled={checking || pending}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.27 3v9.63L7.73 3H1v18h6.73v-9.63L16.27 21H23V3z" /></svg>
          <span>{checking ? '로그인 확인 중…' : pending ? '네이버로 이동 중…' : '네이버로 로그인'}</span>
        </button>
        {(loginError || error) && <p className="login-error" role="alert">{loginError || error}</p>}
        <p className="login-security"><ShieldCheck size={16} />네이버에서 안전하게 로그인해요.</p>
        <div className="login-next"><strong>로그인 후, 이렇게 시작해요</strong><p>우리 가게 업종을 선택하면<br />네 명의 비서가 사장님을 기다리고 있어요.</p></div>
      </section>
    </main>
    <div className="login-footer"><Footer /></div>
  </div>
}
