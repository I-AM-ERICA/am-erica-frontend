import { ArrowLeft, ArrowRight, Check, Copy, Download, ExternalLink, ImagePlus, Image as ImageIcon, LoaderCircle, Sparkles, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import StaffAvatar from '../components/StaffAvatar'
import { downloadMarketingImage, marketingCaption, parseMarketingResult, readReferenceImage } from '../services/marketing'
import type { MarketingGenerator, MarketingResult, ReferenceImage } from '../services/marketing'
import type { Activity, StoreProfile } from '../types'
import './styles/marketing.css'

interface MarketingPageProps { profile: StoreProfile; onBack: () => void; onSave: (activity: Activity) => void; onToast: (message: string) => void; onGenerate?: MarketingGenerator }
const tones = ['따뜻하고 친근하게', '깔끔하고 담백하게', '눈에 띄고 활기차게']

export default function MarketingPage({ profile, onBack, onSave, onToast, onGenerate }: MarketingPageProps) {
  const [reference, setReference] = useState<ReferenceImage | null>(null)
  const [product, setProduct] = useState('')
  const [message, setMessage] = useState('')
  const [tone, setTone] = useState(tones[0])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [result, setResult] = useState<MarketingResult | null>(null)
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const request = useRef<AbortController | null>(null)
  const downloadRequest = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadVersion = useRef(0)
  const mounted = useRef(true)
  const cancelled = useRef(false)
  const resultPanel = useRef<HTMLElement>(null)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; uploadVersion.current++; request.current?.abort(); downloadRequest.current?.abort() }
  }, [])
  const upload = async (file?: File) => {
    if (!file || busy) return
    const version = ++uploadVersion.current
    setUploading(true); setUploadError('')
    try {
      const next = await readReferenceImage(file)
      const image = new window.Image()
      image.src = next.previewUrl
      await image.decode()
      if (mounted.current && version === uploadVersion.current) setReference(next)
    } catch (cause) {
      if (mounted.current && version === uploadVersion.current) setUploadError(cause instanceof Error && cause.name !== 'EncodingError' ? cause.message : '이미지를 읽지 못했어요. 다른 이미지로 시도해 주세요.')
    } finally { if (mounted.current && version === uploadVersion.current) setUploading(false) }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (request.current || uploading) return
    if (!onGenerate) { setError('카드뉴스 생성은 연결 준비 중이에요.'); return }
    if (!reference || !product.trim() || !message.trim()) { setError('참고 이미지와 홍보 주제, 글귀를 모두 입력해 주세요.'); return }
    const controller = new AbortController()
    request.current = controller
    cancelled.current = false
    setBusy(true); setError(''); setResult(null); setDownloadError(''); setImageState('loading')
    let timedOut = false
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 120000)
    try {
      const generated = parseMarketingResult(await onGenerate({ product, message, tone, referenceImage: reference }, profile, controller.signal))
      if (!mounted.current || controller.signal.aborted) return
      setResult(generated)
      if (generated.imageUrl) {
        onSave({ id: crypto.randomUUID(), assistant: 'marketing', title: product.trim(), description: '참고 이미지로 만든 카드뉴스', content: marketingCaption(generated), imageUrl: generated.imageUrl, createdAt: new Date().toISOString() })
      }
      resultPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } catch (cause) {
      if (mounted.current) setError(cancelled.current ? '제작 요청을 취소했어요. 입력 내용은 그대로 남아 있어요.' : timedOut ? '카드뉴스 제작 시간이 초과됐어요. 다시 시도해 주세요.' : cause instanceof Error && cause.name !== 'TypeError' ? cause.message : '홍보 비서에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      window.clearTimeout(timeout); request.current = null
      if (mounted.current) setBusy(false)
    }
  }
  const download = async () => {
    if (!result?.imageUrl || downloading) return
    const controller = new AbortController()
    downloadRequest.current = controller
    setDownloading(true); setDownloadError('')
    const timeout = window.setTimeout(() => controller.abort(), 30000)
    try { await downloadMarketingImage(result.imageUrl, controller.signal) }
    catch { if (mounted.current) setDownloadError('직접 저장하지 못했어요. 원본 보기를 눌러 이미지를 저장해 주세요.') }
    finally { window.clearTimeout(timeout); downloadRequest.current = null; if (mounted.current) setDownloading(false) }
  }

  return <div className="marketing-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={15} />비서 선택으로 돌아가기</button>
    <header className="marketing-heading"><StaffAvatar id="marketing" /><div><p>우리 가게의 매력을 한 장에</p><h1>홍보 비서</h1><span>참고 이미지와 글귀로, 전하고 싶은 소식을 카드뉴스로 만들어 보세요.</span></div></header>
    <div className="marketing-steps" aria-label="카드뉴스 제작 순서"><span><b>1</b>이미지와 글귀 입력</span><ArrowRight size={15} /><span><b>2</b>카드뉴스 만들기</span><ArrowRight size={15} /><span><b>3</b>확인하고 저장</span></div>
    <div className="marketing-workspace">
      <form className="marketing-form panel" onSubmit={submit}>
        <div className="marketing-section-title"><h2>어떤 소식을 전할까요?</h2><span>제작 요청</span></div>
        <fieldset disabled={busy} className="marketing-fields">
          <label className="marketing-label" htmlFor="marketing-reference">참고 이미지 <span>필수</span></label>
          <p className="marketing-field-help">참고할 카드뉴스나 상품 사진을 한 장 올려 주세요.</p>
          <input ref={fileInput} id="marketing-reference" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = '' }} />
          <div className={`marketing-upload ${dragging ? 'is-dragging' : ''} ${reference ? 'has-image' : ''}`} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) void upload(event.dataTransfer.files[0]) }}>
            {reference ? <><img src={reference.previewUrl} alt="업로드한 참고 이미지" /><div className="marketing-upload-actions"><span title={reference.name}>{reference.name}</span><button type="button" onClick={() => fileInput.current?.click()} aria-label="참고 이미지 변경"><Upload size={15} />변경</button><button type="button" aria-label="참고 이미지 제거" onClick={() => { uploadVersion.current++; setReference(null); setUploading(false); setUploadError('') }}><X size={17} /></button></div></> : <button type="button" className="marketing-upload-prompt" onClick={() => fileInput.current?.click()}><span><ImagePlus size={28} strokeWidth={1.5} /></span><strong>이미지를 올려 주세요</strong><small>클릭하거나 이곳에 끌어다 놓으세요</small><em>JPG · PNG · WEBP / 최대 5MB</em></button>}
            {uploading && <div className="marketing-upload-loading" role="status"><LoaderCircle size={20} className="spin" />이미지 확인 중</div>}
          </div>
          {uploadError && <p className="marketing-error" role="alert">{uploadError}</p>}
          <label className="marketing-label" htmlFor="marketing-product">홍보할 주제 <span>필수</span></label>
          <input id="marketing-product" placeholder="예: 신메뉴 딸기 라떼 출시" value={product} onChange={(event) => setProduct(event.target.value)} maxLength={100} required />
          <label className="marketing-label" htmlFor="marketing-message">카드뉴스에 넣을 글귀 <span>필수</span></label>
          <textarea id="marketing-message" placeholder={'예: 달콤한 봄을 한 잔에!\n신선한 딸기로 만든 라떼를 만나보세요.\n이번 주 방문 시 10% 할인'} value={message} onChange={(event) => setMessage(event.target.value)} rows={5} maxLength={500} required />
          <div className="marketing-input-caption"><span>강조할 문구, 혜택, 기간을 함께 적어 주세요.</span><span>{message.length}/500</span></div>
          <fieldset className="marketing-tone"><legend>어떤 분위기로 만들까요?</legend><div>{tones.map((option) => <button key={option} type="button" aria-pressed={tone === option} onClick={() => setTone(option)}>{tone === option && <Check size={13} />}{option}</button>)}</div></fieldset>
        </fieldset>
        {error && <p className="marketing-error" role="alert">{error}</p>}
        <button type="submit" className="marketing-create" disabled={!onGenerate || busy || uploading || !reference || !product.trim() || !message.trim()}>{busy ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />}{busy ? '카드뉴스를 만들고 있어요' : result ? '다시 만들기' : '카드뉴스 만들기'}</button>
        {!onGenerate && <p className="marketing-connection-note">카드뉴스 생성은 준비 중이에요. 참고 이미지와 글귀를 먼저 입력해 보세요.</p>}
        {busy && <button type="button" className="marketing-cancel" onClick={() => { cancelled.current = true; request.current?.abort() }}>제작 요청 취소</button>}
      </form>
      <section className="marketing-result panel" ref={resultPanel} aria-label="카드뉴스 제작 결과" aria-busy={busy}>
        <div className="marketing-section-title"><h2>완성된 카드뉴스</h2><span>{busy ? '제작 중' : result?.imageUrl ? '생성 결과' : !onGenerate ? '연결 준비 중' : '미리보기'}</span></div>
        <div className="marketing-canvas">
          {busy ? <div className="marketing-result-empty" role="status"><span className="marketing-result-symbol"><LoaderCircle size={30} className="spin" /></span><h3>가게의 이야기를 담고 있어요</h3><p>참고 이미지와 글귀를 바탕으로<br />카드뉴스를 제작하고 있어요.</p><span className="marketing-pending-note">완성되면 이곳에서 확인할 수 있어요.</span></div> : result?.imageUrl ? <>
            {imageState === 'loading' && <div className="marketing-result-empty" role="status"><LoaderCircle size={28} className="spin" /><p>이미지를 불러오고 있어요.</p></div>}
            {imageState !== 'error' && <img className={`marketing-generated-image ${imageState === 'loading' ? 'is-loading' : ''}`} src={result.imageUrl} alt={`${result.headline || product} 카드뉴스 생성 결과`} onLoad={() => setImageState('ready')} onError={() => setImageState('error')} />}
            {imageState === 'error' && <div className="marketing-result-empty"><ImageIcon size={30} /><h3>이미지를 불러오지 못했어요</h3><p>아래 원본 보기에서 다시 확인해 주세요.</p></div>}
          </> : <div className="marketing-result-empty"><span className="marketing-result-symbol"><ImageIcon size={32} strokeWidth={1.4} /></span><h3>{result ? '이미지 결과가 도착하지 않았어요' : '우리 가게의 다음 카드뉴스'}</h3><p>{result ? '문구는 받았지만 카드뉴스 이미지가 없어요.\n다시 만들기를 눌러 시도해 주세요.' : '이미지와 글귀를 넣으면\n완성된 카드뉴스를 이곳에 보여드릴게요.'}</p>{!result && <div className="marketing-preview-tags"><span>참고 이미지</span><b>+</b><span>전하고 싶은 글귀</span></div>}</div>}
        </div>
        {result?.imageUrl && <div className="marketing-result-actions"><button className="primary-button" onClick={() => void download()} disabled={downloading || busy}>{downloading ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}{downloading ? '저장 준비 중' : '이미지 저장'}</button><a className="secondary-button" href={result.imageUrl} target="_blank" rel="noreferrer">원본 보기<ExternalLink size={15} /></a></div>}
        {downloadError && <p className="marketing-error" role="alert">{downloadError}</p>}
        {result && <div className="marketing-copy-result"><div><h3>함께 사용할 홍보 문구</h3><button aria-label="홍보 문구 복사" onClick={async () => { try { await navigator.clipboard.writeText(marketingCaption(result)); onToast('홍보 문구를 복사했어요.') } catch { onToast('복사 권한을 확인해 주세요.') } }}><Copy size={14} />복사</button></div>{result.headline && <strong>{result.headline}</strong>}<p>{result.body}</p>{result.hashtags.length > 0 && <div className="marketing-hashtags">{result.hashtags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</div>}</div>}
        <p className="marketing-result-note">게시하기 전에 이미지 속 글귀와 행사 정보를 확인해 주세요.</p>
        <span className="visually-hidden" role="status">{busy ? '카드뉴스 제작 중' : result?.imageUrl ? '카드뉴스 생성 응답을 받았습니다.' : result ? '이미지 생성 결과가 없습니다.' : ''}</span>
      </section>
    </div>
  </div>
}
