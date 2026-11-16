import { Mail, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { sendPolicyDigest } from '../services/policy-reminder'
import type { PolicyDeliveryResult } from '../services/policy-reminder'
import type { StoreProfile } from '../types'

interface Props {
  profile: StoreProfile
  disabled: boolean
  onResult?: (result: PolicyDeliveryResult) => void
  onBusyChange?: (busy: boolean) => void
}

export default function PolicyDigestButton({ profile, disabled, onResult, onBusyChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; active.current?.abort() }
  }, [])

  const send = async () => {
    if (disabled || active.current) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true); onBusyChange?.(true); setNotice(''); setError('')
    const timer = window.setTimeout(() => controller.abort(), 150000)
    try {
      const result = await sendPolicyDigest(profile, controller.signal)
      if (mounted.current) {
        setNotice(`${result.email}로 메일을 발송했어요. 검색 결과는 대화에서도 확인할 수 있어요.`)
        onResult?.(result)
      }
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error && !['TypeError', 'AbortError', 'TimeoutError'].includes(caught.name)
        ? caught.message : '발송 결과를 확인하지 못했어요. 다시 누르기 전에 받은메일함을 확인해 주세요.')
    } finally {
      window.clearTimeout(timer); active.current = null
      if (mounted.current) { setBusy(false); onBusyChange?.(false) }
    }
  }

  return <div className="policy-digest">
    <button type="button" className="policy-digest-button" disabled={disabled || busy} onClick={() => void send()}>
      {busy ? <LoaderCircle size={16} className="policy-digest-spinner" aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
      {busy ? '정책 검색·메일 발송 중…' : '정책 검색 후 이메일로 받기'}
    </button>
    <p>정책 비서가 최신 공고를 검색해 출처와 함께 보내드려요. 매일 오전 6시에도 같은 방식으로 갱신하며, 자동 알림이 OFF여도 이 버튼은 사용할 수 있어요.</p>
    <div role="status">{busy ? '정책을 검색하고 있어요. 완료되면 로그인한 이메일로 보내드려요.' : notice}</div>
    {error && <div className="policy-reminder-error" role="alert">{error}</div>}
  </div>
}
