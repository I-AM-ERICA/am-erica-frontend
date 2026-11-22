import { ArrowLeft, ShieldCheck, Store } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Footer from '../components/Footer'
import { loginWithEmail, requestSignupCode, signupWithEmail, startNaverLogin } from '../services/auth'
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
interface Challenge { id: string; expiresAt: number; resendAt: number }

export default function Login({ onBack, returnTo, onAuthenticated, checking = false, error = '' }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [pending, setPending] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [now, setNow] = useState(Date.now())
  const [notice, setNotice] = useState('')
  const busy = useRef(false)
  const codeInput = useRef<HTMLInputElement>(null)
  const blocked = checking || pending
  const remaining = challenge ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000)) : 0
  const resend = challenge ? Math.max(0, Math.ceil((challenge.resendAt - now) / 1000)) : 0
  useEffect(() => {
    const onPageShow = () => { busy.current = false; setPending(false) }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])
  useEffect(() => {
    if (!challenge) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    codeInput.current?.focus()
    return () => window.clearInterval(timer)
  }, [challenge])

  const run = async (action: () => Promise<void>) => {
    if (busy.current || checking) return
    busy.current = true; setPending(true); setLoginError('')
    try { await action() } catch (cause) {
      setLoginError(cause instanceof Error && cause.name !== 'TypeError' && cause.name !== 'TimeoutError'
        ? cause.message : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally { busy.current = false; setPending(false) }
  }
  const sendCode = async () => {
    const result = await requestSignupCode(email)
    const sent = Date.now()
    setNow(sent); setCode('')
    setChallenge({ id: result.verificationId, expiresAt: sent + result.expiresIn * 1000, resendAt: sent + result.resendAfter * 1000 })
    setNotice('인증번호를 보냈어요. 메일이 보이지 않으면 스팸함도 확인해 주세요.')
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void run(async () => {
      if (mode === 'signup') {
        if (password !== confirmation) throw new Error('비밀번호가 서로 달라요. 다시 확인해 주세요.')
        if (new TextEncoder().encode(password).length > 72) throw new Error('비밀번호는 영문·숫자 72자, 한글 24자 이내로 입력해 주세요.')
        if (!challenge) { await sendCode(); return }
        if (!remaining) throw new Error('인증 시간이 지났어요. 인증번호를 다시 받아 주세요.')
      }
      const user = mode === 'signup' && challenge
        ? await signupWithEmail(email, password, name, challenge.id, code)
        : await loginWithEmail(email, password)
      setPassword(''); setConfirmation(''); setCode('')
      const destination = returnTo === 'login' || returnTo === 'intro' ? 'setup' : returnTo
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${destination}`)
      onAuthenticated?.(user)
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
  const changeMode = (next: 'login' | 'signup') => {
    setMode(next); setPassword(''); setConfirmation(''); setCode(''); setChallenge(null); setNotice(''); setLoginError('')
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
        <h1 id="login-title">{mode === 'signup' ? '가게비서와 함께해요.' : '반가워요, 사장님.'}</h1>
        <p className="login-description">{mode === 'signup' ? '이메일을 인증하고 우리 가게의 비서를 만나보세요.' : '가입한 이메일로 로그인해 주세요.'}</p>
        <div className="login-modes" aria-label="로그인 또는 회원가입">
          <button type="button" aria-pressed={mode === 'login'} disabled={blocked} onClick={() => changeMode('login')}>이메일 로그인</button>
          <button type="button" aria-pressed={mode === 'signup'} disabled={blocked} onClick={() => changeMode('signup')}>회원가입</button>
        </div>
        <form className="email-auth-form" onSubmit={submit}>
          {mode === 'signup' && <label htmlFor="signup-name">이름<input id="signup-name" autoComplete="name" required maxLength={50} value={name} disabled={blocked} onChange={(event) => setName(event.target.value)} /></label>}
          <label htmlFor="auth-email">이메일<input id="auth-email" type="email" autoComplete="email" required maxLength={255} value={email} disabled={blocked} readOnly={!!challenge} onChange={(event) => setEmail(event.target.value)} /></label>
          {challenge && <button className="email-auth-link" type="button" disabled={blocked} onClick={() => { setChallenge(null); setCode(''); setNotice('') }}>이메일 주소 변경</button>}
          <label htmlFor="auth-password">비밀번호<input id="auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : undefined} maxLength={72} value={password} disabled={blocked} onChange={(event) => setPassword(event.target.value)} aria-describedby={mode === 'signup' ? 'password-hint' : undefined} /></label>
          {mode === 'signup' && <>
            <p id="password-hint" className="email-auth-hint">8자 이상 입력해 주세요.</p>
            <label htmlFor="signup-confirm">비밀번호 확인<input id="signup-confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmation} disabled={blocked} onChange={(event) => setConfirmation(event.target.value)} /></label>
          </>}
          {mode === 'signup' && challenge && <div className="email-verification">
            <label htmlFor="signup-code">이메일 인증번호<input ref={codeInput} id="signup-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required minLength={6} maxLength={6} placeholder="6자리 인증번호" value={code} disabled={blocked} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} aria-describedby="code-time" /></label>
            <div className="email-code-actions"><span id="code-time">{remaining ? `남은 시간 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : '인증 시간이 지났어요.'}</span><button type="button" disabled={blocked || resend > 0} onClick={() => void run(sendCode)}>{resend > 0 ? `${resend}초 후 재전송` : '인증번호 재전송'}</button></div>
          </div>}
          {notice && <p className="email-auth-notice" role="status">{notice}</p>}
          {(loginError || error) && <p className="login-error" role="alert">{loginError || error}</p>}
          <button className="email-auth-submit" type="submit" disabled={blocked || (mode === 'signup' && !!challenge && remaining === 0)}>{checking ? '로그인 확인 중…' : pending ? '처리 중…' : mode === 'login' ? '이메일로 로그인' : challenge ? '인증하고 가입 완료' : '인증번호 받기'}</button>
        </form>
        {mode === 'signup' ? <p className="login-security"><ShieldCheck size={16} />이메일 인증을 완료하면 계정이 만들어져요.</p> : <>
          <div className="login-divider">또는</div>
          <button className="naver-login-button" onClick={handleNaver} disabled={blocked}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.27 3v9.63L7.73 3H1v18h6.73v-9.63L16.27 21H23V3z" /></svg>
            <span>네이버로 로그인</span>
          </button>
          <p className="login-security">기존 네이버 가입자는 네이버로 로그인해 주세요.</p>
        </>}
        <div className="login-next"><strong>로그인 후, 이렇게 시작해요</strong><p>우리 가게 업종을 선택하면<br />네 명의 비서가 사장님을 기다리고 있어요.</p></div>
      </section>
    </main>
    <div className="login-footer"><Footer /></div>
  </div>
}
