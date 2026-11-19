import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { loadPostcode, selectedAddress } from '../services/postcode'
import '../pages/styles/address-search.css'

export default function AddressSearchDialog({ onSelect, onClose }: {
  onSelect: (value: { address: string; region: string }) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onSelect, onClose })
  callbacks.current = { onSelect, onClose }
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  useEffect(() => {
    let disposed = false
    const element = container.current!
    setError(''); setReady(false)
    const timer = window.setTimeout(() => { if (!disposed) setError('주소 검색 연결이 지연되고 있어요. 다시 시도해 주세요.') }, 20000)
    loadPostcode().then((Postcode) => {
      if (disposed) return
      new Postcode({ width: '100%', height: '100%', onresize: () => {
        if (!disposed) { window.clearTimeout(timer); setReady(true); setError('') }
      }, oncomplete: (data) => {
        if (disposed) return
        try { callbacks.current.onSelect(selectedAddress(data)) }
        catch (cause) { setError(cause instanceof Error ? cause.message : '주소를 확인하지 못했어요.') }
      } }).embed(element)
    }).catch((cause) => {
      if (!disposed) { window.clearTimeout(timer); setError(cause instanceof Error ? cause.message : '주소 검색을 불러오지 못했어요.') }
    })
    return () => { disposed = true; window.clearTimeout(timer); element.replaceChildren() }
  }, [attempt])
  return <dialog ref={dialog} className="address-search-dialog" aria-labelledby="address-search-title"
    onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header><h2 id="address-search-title">가게 주소 검색</h2><button type="button" onClick={onClose} aria-label="주소 검색 닫기"><X size={20} /></button></header>
    {!ready && !error && <p role="status" className="address-search-notice">주소 검색을 불러오는 중이에요.</p>}
    {error && <div className="address-search-notice"><p role="alert">{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div>}
    <div className="address-search-frame" ref={container} />
  </dialog>
}
