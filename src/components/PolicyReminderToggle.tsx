import { Bell, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getPolicyReminder, setPolicyReminder } from '../services/policy-reminder'
import type { PolicyReminderSettings } from '../services/policy-reminder'
import type { StoreProfile } from '../types'
import PolicyDigestButton from './PolicyDigestButton'
import type { PolicyDeliveryResult } from '../services/policy-reminder'

export default function PolicyReminderToggle({ profile, chatBusy = false, onResult, onBusyChange }: {
  profile: StoreProfile; chatBusy?: boolean
  onResult?: (result: PolicyDeliveryResult) => void; onBusyChange?: (busy: boolean) => void
}) {
  const [settings, setSettings] = useState<PolicyReminderSettings | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    active.current = controller
    setBusy(true); setError('')
    const timer = window.setTimeout(() => controller.abort(), 15000)
    let disposed = false
    getPolicyReminder(controller.signal).then((value) => { if (!disposed) setSettings(value) }).catch(() => {
      if (!disposed) setError('알림 설정을 불러오지 못했어요. 다시 시도해 주세요.')
    }).finally(() => { window.clearTimeout(timer); if (!disposed) setBusy(false) })
    return () => { disposed = true; mounted.current = false; window.clearTimeout(timer); active.current?.abort() }
  }, [reload])

  const toggle = async () => {
    if (!settings || busy) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true); setError('')
    const timer = window.setTimeout(() => controller.abort(), 15000)
    try {
      const value = await setPolicyReminder(!settings.enabled, profile, controller.signal)
      if (!controller.signal.aborted) setSettings(value)
    } catch (caught) {
      if (!mounted.current) return
      if (!controller.signal.aborted) setError(caught instanceof Error && caught.name !== 'TypeError' ? caught.message : '알림을 저장하지 못했어요. 다시 시도해 주세요.')
      else setError('저장 상태를 확인하지 못했어요. 다시 불러와 주세요.')
    } finally { window.clearTimeout(timer); if (mounted.current) setBusy(false) }
  }
  return <aside className="policy-reminder" aria-label="정책 이메일 알림 설정" aria-busy={busy}>
    <div className="policy-reminder-main"><Bell size={18} aria-hidden="true" /><div className="policy-reminder-copy">
      <strong id="policy-reminder-label">오전 6시 이메일 알림 <span>한국 시간</span></strong>
      <p id="policy-reminder-description">매일 오전 6시에 최신 공고를 검색해요. 접수 기간이 남은 등록 정책은 보냈던 내용도 매일 다시 알려드려요.</p>
    </div><button type="button" className="policy-reminder-switch" role="switch" aria-checked={settings?.enabled ?? false} aria-labelledby="policy-reminder-label" aria-describedby="policy-reminder-description" disabled={busy || !settings || (!settings.email && !settings.enabled)} onClick={() => void toggle()}>
      {busy ? '확인 중' : settings ? settings.enabled ? 'ON' : 'OFF' : '확인 필요'}
    </button></div>
    <div className="policy-reminder-status" role="status">
      {settings && <><p>{settings.email ? `받는 주소: ${settings.email}` : '이메일 제공에 동의한 네이버 계정으로 다시 로그인해 주세요.'}{settings.enabled && settings.storeName ? ` · ${settings.storeName} 기준` : ''}</p>
        <p>{settings.enabled ? '검색 결과 신청 가능한 정책이 없는 날에도 확인 메일을 보내드려요. 검색 실패 시에는 발송하지 않아요.' : '알림을 켜면 로그인한 이메일로 매일 최신 검색 결과를 보내드려요.'}</p>
        {!settings.deliveryConfigured && <p>{settings.manualDeliveryConfigured ? '자동 발송은 준비 중이에요. 아래 버튼으로 지금 검색해서 메일을 받을 수 있어요.' : '이메일 발송 준비 중입니다. 알림 설정은 저장되며, 발송 설정이 완료된 후 메일을 받을 수 있어요.'}</p>}
        {settings.lastSentDate && <p>최근 자동 발송: {settings.lastSentDate}</p>}</>}
    </div>
    <PolicyDigestButton profile={profile} disabled={busy || chatBusy || !settings?.email || !settings.manualDeliveryConfigured} onResult={onResult} onBusyChange={onBusyChange} />
    {error && <div className="policy-reminder-error"><p role="alert">{error}</p><button type="button" disabled={busy} onClick={() => setReload((n) => n + 1)}><RotateCcw size={13} />다시 불러오기</button></div>}
  </aside>
}
