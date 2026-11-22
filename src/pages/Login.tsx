import { ArrowLeft, ShieldCheck, Store } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Footer from '../components/Footer'
import { clearNaverRegistration, getNaverRegistration, requestNaverSignupCode, verifyNaverSignup, startNaverLogin } from '../services/auth'
import type { AuthUser } from '../services/auth'
import type { AppPage } from '../types'
import './styles/login.css'

interface LoginProps {
  onBack: () => void
  returnTo: AppPage
  onAuthenticated?: (user: AuthUser) => void
  checking?: boolean
  error?: string
}

export default function Login({ onBack, returnTo, onAuthenticated, checking = false, error = '' }: LoginProps) {
  const [registration, setRegistration] = useState(getNaverRegistration)
  const [pending, setPending] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [code, setCode] = useState('')
  const [now, setNow] = useState(Date.now())
  const [notice, setNotice] = useState('')
  const busy = useRef(false)
  const codeInput = useRef<HTMLInputElement>(null)
  const blocked = checking || pending
  const challenge = registration?.challenge
  const remaining = challenge ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000)) : 0
  const resend = challenge ? Math.max(0, Math.ceil((challenge.resendAt - now) / 1000)) : 0
  const expired = !!registration && registration.expiresAt <= now
  useEffect(() => {
    if (!registration) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [registration])
  useEffect(() => { if (challenge) codeInput.current?.focus() }, [challenge])
  const run = async (task: () => Promise<void>) => {
    if (busy.current || checking) return
    busy.current = true; setPending(true); setLoginError('')
    try { await task() } catch (cause) {
      setLoginError(cause instanceof Error && cause.name !== 'TypeError' && cause.name !== 'TimeoutError'
        ? cause.message : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setRegistration(getNaverRegistration())
    } finally { busy.current = false; setPending(false) }
  }
  const sendCode = async () => {
    setRegistration(await requestNaverSignupCode())
    setNow(Date.now()); setCode('')
    setNotice('인증번호를 보냈어요. 메일이 보이지 않으면 스팸함도 확인해 주세요.')
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void run(async () => {
      const result = await verifyNaverSignup(code)
      setCode('')
      const destination = result.returnTo === 'login' || result.returnTo === 'intro' ? 'setup' : result.returnTo
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${destination}`)
      onAuthenticated?.(result.user)
    })
  }
  const handleNaver = () => {
    if (busy.current || checking) return
    setLoginError(''); setPending(true); busy.current = true
    try { startNaverLogin(returnTo) } catch (cause) {
      busy.current = false; setPending(false)
      setLoginError(cause instanceof Error ? cause.message : '로그인을 시작하지 못했어요.')
    }
  }
  return <div className="login-page">
    <header className="login-header">
      <a className="login-brand" href="#intro" aria-label="가게비서 홈"><Store size={28} strokeWidth={1.7} />가게비서<span>.</span></a>
      <button className="login-back" onClick={onBack}><ArrowLeft size={16} />처음으로</button>
    </header>
    <main className="login-main">
      <section className="login-card" aria-labelledby="login-title" aria-busy={blocked}>
        <div className="login-symbol"><Store size={34} strokeWidth={1.5} /></div>
        <p className="login-eyebrow">사장님 곁에, 가게비서</p>
        <h1 id="login-title">{registration ? '처음 오셨네요, 사장님.' : '반가워요, 사장님.'}</h1>
        <p className="login-description">{registration ? '가입을 완료하려면 네이버 계정의 이메일을 인증해 주세요.' : '네이버 계정으로 간편하게 로그인하고\n우리 가게에 필요한 비서를 만나보세요.'}</p>
        {registration ? <>
          <div className="email-auth-form">
            <p className="email-auth-hint">인증받을 네이버 계정 이메일</p>
            <p className="naver-verification-email">{registration.email}</p>
            {!challenge && <button className="email-auth-submit" type="button" disabled={blocked || expired} onClick={() => void run(sendCode)}>{pending ? '보내는 중…' : '인증번호 받기'}</button>}
          </div>
          {challenge && <form className="email-auth-form" onSubmit={submit}>
            <div className="email-verification">
              <label htmlFor="signup-code">이메일 인증번호<input ref={codeInput} id="signup-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required minLength={6} maxLength={6} placeholder="6자리 인증번호" value={code} disabled={blocked || expired} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} aria-describedby="code-time" /></label>
              <div className="email-code-actions"><span id="code-time">{remaining ? `남은 시간 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : '인증 시간이 지났어요.'}</span><button type="button" disabled={blocked || expired || resend > 0} onClick={() => void run(sendCode)}>{resend > 0 ? `${resend}초 후 재전송` : '인증번호 재전송'}</button></div>
            </div>
            <button className="email-auth-submit" type="submit" disabled={blocked || remaining === 0 || expired}>{pending ? '인증 확인 중…' : '인증하고 시작하기'}</button>
          </form>}
          {expired && <p className="login-error" role="alert">가입 인증 요청이 만료되었어요. 네이버로 다시 로그인해 주세요.</p>}
          {notice && <p className="email-auth-notice" role="status">{notice}</p>}
          <p className="login-security"><ShieldCheck size={16} />처음 한 번 인증하면 가입이 완료돼요.</p>
          <button className="email-auth-link" type="button" disabled={blocked} onClick={() => { clearNaverRegistration(); setRegistration(null); setCode(''); setNotice(''); setLoginError('') }}>네이버 로그인부터 다시 하기</button>
        </> : <>
          <button className="naver-login-button" onClick={handleNaver} disabled={blocked}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.27 3v9.63L7.73 3H1v18h6.73v-9.63L16.27 21H23V3z" /></svg>
            <span>{checking ? '로그인 확인 중…' : pending ? '네이버로 이동 중…' : '네이버로 로그인'}</span>
          </button>
          <p className="login-security"><ShieldCheck size={16} />처음 가입할 때만 이메일 인증을 진행해요.</p>
        </>}
        {(loginError || error) && <p className="login-error" role="alert">{loginError || error}</p>}
        <div className="login-next"><strong>로그인 후, 이렇게 시작해요</strong><p>우리 가게 업종을 선택하면<br />네 명의 비서가 사장님을 기다리고 있어요.</p></div>
      </section>
    </main>
    <div className="login-footer"><Footer /></div>
  </div>
}
