import { ArrowLeft, ArrowRight, Check, Copy, Download, ExternalLink, ImagePlus, Image as ImageIcon, LoaderCircle, Sparkles, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import StaffAvatar from '../components/StaffAvatar'
import { downloadMarketingImage, getMarketingDraft, MarketingConflict, marketingCaption, readReferenceImage } from '../services/marketing'
import type { MarketingDraft, MarketingGenerator, MarketingReviser, ReferenceImage } from '../services/marketing'
import type { Activity, StoreProfile } from '../types'
import './styles/marketing.css'

interface MarketingPageProps { profile: StoreProfile; onBack: () => void; onSave: (activity: Activity) => void; onToast: (message: string) => void; onGenerate?: MarketingGenerator; onRevise?: MarketingReviser }
const tones = ['따뜻하고 친근하게', '깔끔하고 담백하게', '눈에 띄고 활기차게']
const layouts: Record<string, string> = { editorial: '시그니처', bold_sale: '위크엔드 딜', soft_frame: '작은 선물', split: '컬렉션', night: '프리미엄', market: '동네의 발견', type_stack: '타이포 팝', magazine: '매거진', spotlight: '스튜디오 글로우', diagonal: '다이내믹', floating_type: '플로팅 타입', big_focus: '빅 포커스' }

export default function MarketingPage({ profile, onBack, onSave, onToast, onGenerate, onRevise }: MarketingPageProps) {
  const [reference, setReference] = useState<ReferenceImage | null>(null)
  const [styleReference, setStyleReference] = useState<ReferenceImage | undefined>()
  const [logo, setLogo] = useState<ReferenceImage | undefined>()
  const [product, setProduct] = useState('')
  const [message, setMessage] = useState('')
  const [tone, setTone] = useState(tones[0])
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [period, setPeriod] = useState('')
  const [contact, setContact] = useState('')
  const [hideFooter, setHideFooter] = useState(false)
  const [backgroundMode, setBackgroundMode] = useState<'auto' | 'remove' | 'keep'>('auto')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [revising, setRevising] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [error, setError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [drafts, setDrafts] = useState<MarketingDraft[]>([])
  const [selected, setSelected] = useState(0)
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
  const draft = drafts[selected]
  const result = draft?.result
  const working = busy || revising

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; uploadVersion.current++; request.current?.abort(); downloadRequest.current?.abort() }
  }, [])
  const upload = async (file?: File, kind: 'product' | 'style' | 'logo' = 'product') => {
    if (!file || working || uploading) return
    const version = ++uploadVersion.current
    setUploading(true); setUploadError('')
    try {
      const next = await readReferenceImage(file)
      const image = new window.Image(); image.src = next.previewUrl; await image.decode()
      if (image.naturalWidth * image.naturalHeight > 20000000) throw new Error('사진은 2천만 화소 이하로 올려 주세요.')
      if (mounted.current && version === uploadVersion.current) {
        if (kind === 'product') setReference(next)
        else if (kind === 'style') setStyleReference(next)
        else setLogo(next)
      }
    } catch (cause) {
      if (mounted.current && version === uploadVersion.current) setUploadError(cause instanceof Error && cause.name !== 'EncodingError' ? cause.message : '이미지를 읽지 못했어요. 다른 이미지로 시도해 주세요.')
    } finally { if (mounted.current && version === uploadVersion.current) setUploading(false) }
  }
  const saveActivity = (item: MarketingDraft) => {
    if (item.result.imageUrl) onSave({ id: `promotion-${item.id}-v${item.version}`, assistant: 'marketing', title: item.result.headline,
      description: `상품 사진으로 만든 포스터 · 버전 ${item.version}`, content: marketingCaption(item.result), imageUrl: item.result.imageUrl, createdAt: new Date().toISOString() })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (request.current || uploading || !onGenerate) return
    if (!reference || !product.trim() || !message.trim()) { setError('상품 사진과 상품명, 글귀를 입력해 주세요.'); return }
    if (originalPrice && (!price || Number(originalPrice) <= Number(price))) { setError('할인 전 가격은 판매가보다 커야 해요.'); return }
    const controller = new AbortController(); request.current = controller; cancelled.current = false
    setBusy(true); setError(''); setDownloadError('')
    let timedOut = false
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 120000)
    try {
      const generated = await onGenerate({ product, message, tone, referenceImage: reference, styleReference, logo,
        price: price === '' ? undefined : Number(price), originalPrice: originalPrice === '' ? undefined : Number(originalPrice), period, contact, hideFooter, backgroundMode }, profile, controller.signal)
      if (!mounted.current || controller.signal.aborted) return
      setDrafts(generated.drafts); setSelected(0); setInstruction(''); setImageState('loading')
      resultPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } catch (cause) {
      if (mounted.current) setError(cancelled.current ? '제작 요청을 취소했어요. 입력 내용은 그대로 남아 있어요.' : timedOut ? '포스터 제작 시간이 초과됐어요. 다시 시도해 주세요.' : cause instanceof Error && cause.name !== 'TypeError' ? cause.message : '홍보 비서에 연결하지 못했어요.')
    } finally { window.clearTimeout(timeout); request.current = null; if (mounted.current) setBusy(false) }
  }
  const revise = async (text = instruction) => {
    if (!draft || !onRevise || request.current || !text.trim()) return
    const current = draft
    const controller = new AbortController(); request.current = controller
    setRevising(true); setError('')
    const timeout = window.setTimeout(() => controller.abort(), 120000)
    try {
      let next: MarketingDraft
      try { next = await onRevise(current, text, profile, controller.signal) }
      catch (cause) {
        if (!(cause instanceof MarketingConflict)) throw cause
        next = await getMarketingDraft(current.id, profile, controller.signal)
        if (mounted.current) setError(cause.message)
      }
      if (!mounted.current || controller.signal.aborted) return
      setDrafts((items) => items.map((item) => item.id === next.id ? next : item)); setImageState('loading'); setInstruction('')
    } catch (cause) { if (mounted.current) setError(controller.signal.aborted ? '수정 시간이 초과됐어요. 다시 시도해 주세요.' : cause instanceof Error ? cause.message : '수정하지 못했어요.') }
    finally { window.clearTimeout(timeout); request.current = null; if (mounted.current) setRevising(false) }
  }
  const download = async () => {
    if (!draft || !result?.imageUrl || downloading) return
    const controller = new AbortController(); downloadRequest.current = controller
    setDownloading(true); setDownloadError('')
    const timeout = window.setTimeout(() => controller.abort(), 30000)
    try { await downloadMarketingImage(result.imageUrl, controller.signal); if (mounted.current) { saveActivity(draft); onToast('포스터를 저장했어요. 작업 기록에서도 확인할 수 있어요.') } }
    catch { if (mounted.current) setDownloadError('직접 저장하지 못했어요. 원본 보기에서 이미지를 저장해 주세요.') }
    finally { window.clearTimeout(timeout); downloadRequest.current = null; if (mounted.current) setDownloading(false) }
  }

  return <div className="marketing-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={15} />비서 선택으로 돌아가기</button>
    <header className="marketing-heading"><StaffAvatar id="marketing" /><div><p>우리 가게의 매력을 한 장에</p><h1>홍보 비서</h1><span>상품 사진 한 장으로 세 가지 포스터를 만들고, 마음에 드는 디자인을 다듬어 보세요.</span></div></header>
    <div className="marketing-steps" aria-label="포스터 제작 순서"><span><b>1</b>상품 사진과 소식 입력</span><ArrowRight size={15} /><span><b>2</b>시안 3개 중 선택</span><ArrowRight size={15} /><span><b>3</b>수정하고 저장</span></div>
    <div className="marketing-workspace">
      <form className="marketing-form panel" onSubmit={submit}>
        <div className="marketing-section-title"><h2>어떤 소식을 전할까요?</h2><span>{profile.name}</span></div>
        <fieldset disabled={working || uploading} className="marketing-fields">
          <label className="marketing-label" htmlFor="marketing-reference">상품 사진 <span>필수</span></label>
          <p className="marketing-field-help">포스터에 넣을 실제 상품 사진을 올려 주세요.</p>
          <input ref={fileInput} id="marketing-reference" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = '' }} />
          <div className={`marketing-upload ${dragging ? 'is-dragging' : ''} ${reference ? 'has-image' : ''}`} onDragOver={(event) => { event.preventDefault(); if (!working) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files[0]) }}>
            {reference ? <><img src={reference.previewUrl} alt="업로드한 상품 사진" /><div className="marketing-upload-actions"><span title={reference.name}>{reference.name}</span><button type="button" onClick={() => fileInput.current?.click()} aria-label="상품 사진 변경"><Upload size={15} />변경</button><button type="button" aria-label="상품 사진 제거" onClick={() => setReference(null)}><X size={17} /></button></div></> : <button type="button" className="marketing-upload-prompt" onClick={() => fileInput.current?.click()}><span><ImagePlus size={28} strokeWidth={1.5} /></span><strong>상품 사진을 올려 주세요</strong><small>클릭하거나 이곳에 끌어다 놓으세요</small><em>JPG · PNG · WEBP / 최대 5MB</em></button>}
            {uploading && <div className="marketing-upload-loading" role="status"><LoaderCircle size={20} className="spin" />이미지 확인 중</div>}
          </div>
          <label className="marketing-label" htmlFor="marketing-product">상품명 <span>필수</span></label>
          <input id="marketing-product" placeholder="예: 딸기 라떼" value={product} onChange={(event) => setProduct(event.target.value)} maxLength={100} required />
          <label className="marketing-label" htmlFor="marketing-message">카드뉴스에 넣을 글귀 <span>필수</span></label>
          <textarea id="marketing-message" placeholder="예: 신선한 딸기로 만든 라떼를 만나보세요." value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={500} required />
          <div className="marketing-price-row"><label>판매가 <small>선택 · 원</small><input type="number" min="0" max="999999999" step="1" value={price} placeholder="3500" onChange={(event) => setPrice(event.target.value)} /></label><label>할인 전 가격 <small>선택 · 원</small><input type="number" min="1" max="999999999" step="1" value={originalPrice} placeholder="4000" onChange={(event) => setOriginalPrice(event.target.value)} /></label></div>
          <details className="marketing-options"><summary>사진·디자인 더 설정하기</summary>
            <label>사진 배경<select value={backgroundMode} onChange={(event) => setBackgroundMode(event.target.value as typeof backgroundMode)}><option value="auto">알아서 정리</option><option value="remove">배경 제거</option><option value="keep">원본 배경 유지</option></select></label>
            <label>행사 기간<input value={period} maxLength={60} onChange={(event) => setPeriod(event.target.value)} placeholder="예: 11월 20일 ~ 27일" /></label>
            <label className="marketing-footer-toggle"><input type="checkbox" checked={hideFooter} onChange={(event) => setHideFooter(event.target.checked)} />하단 지역·문의 안내 숨기기</label>
            <label>방문·문의 안내<input disabled={hideFooter} value={contact} maxLength={100} onChange={(event) => setContact(event.target.value)} placeholder="예: 매장 방문 · 포장 가능" /></label>
            <label>참고 광고 <small>선택 · 색감과 구도 참고</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(event.target.files?.[0], 'style'); event.target.value = '' }} /></label>
            {styleReference && <div className="marketing-extra-image"><img src={styleReference.previewUrl} alt="참고 광고" /><span>{styleReference.name}</span><button type="button" onClick={() => setStyleReference(undefined)} aria-label="참고 광고 제거"><X size={16} /></button></div>}
            <label>가게 로고 <small>선택</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(event.target.files?.[0], 'logo'); event.target.value = '' }} /></label>
            {logo && <div className="marketing-extra-image"><img src={logo.previewUrl} alt="가게 로고" /><span>{logo.name}</span><button type="button" onClick={() => setLogo(undefined)} aria-label="로고 제거"><X size={16} /></button></div>}
            <fieldset className="marketing-tone"><legend>어떤 분위기로 만들까요?</legend><div>{tones.map((option) => <button key={option} type="button" aria-pressed={tone === option} onClick={() => setTone(option)}>{tone === option && <Check size={13} />}{option}</button>)}</div></fieldset>
          </details>
        </fieldset>
        {uploadError && <p className="marketing-error" role="alert">{uploadError}</p>}
        {error && <p className="marketing-error" role="alert">{error}</p>}
        <button type="submit" className="marketing-create" disabled={!onGenerate || working || uploading || !reference || !product.trim() || !message.trim()}>{busy ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />}{busy ? '세 가지 시안을 만들고 있어요' : '포스터 3개 만들기'}</button>
        {!onGenerate && <p className="marketing-connection-note">연결 준비 중이에요.</p>}
        {busy && <button type="button" className="marketing-cancel" onClick={() => { cancelled.current = true; request.current?.abort() }}>제작 요청 취소</button>}
      </form>
      <section className="marketing-result panel" ref={resultPanel} aria-label="포스터 제작 결과" aria-busy={working}>
        <div className="marketing-section-title"><h2>완성된 카드뉴스</h2><span>{working ? '제작 중' : draft ? `시안 ${selected + 1} · 버전 ${draft.version}` : '미리보기'}</span></div>
        {draft?.mode === 'demo' && <p className="marketing-mode-note">체험 모드 · 고정 문구와 템플릿을 사용합니다. 자유로운 문구 수정과 참고 광고 분석은 AI 연결 모드에서 지원해요.</p>}
        {drafts.length > 0 && <div className="marketing-drafts" aria-label="시안 선택">{drafts.map((item, index) => <button type="button" key={item.id} disabled={working || downloading} aria-pressed={selected === index} onClick={() => { if (index !== selected) { setSelected(index); setImageState('loading'); setDownloadError(''); setInstruction('') } }}><img src={item.result.imageUrl!} alt={`시안 ${index + 1}`} /><span>{selected === index && <Check size={13} />}{layouts[item.design.template_id || ''] || `시안 ${index + 1}`}</span></button>)}</div>}
        <div className="marketing-canvas">
          {busy ? <div className="marketing-result-empty" role="status"><LoaderCircle size={30} className="spin" /><h3>가게의 이야기를 담고 있어요</h3><p>사진과 글귀로 서로 다른 포스터 3개를 만들어요.</p></div> : result?.imageUrl ? <>
            {imageState === 'loading' && <div className="marketing-result-empty" role="status"><LoaderCircle size={28} className="spin" /><p>이미지를 불러오고 있어요.</p></div>}
            {imageState !== 'error' && <img key={result.imageUrl} className={`marketing-generated-image ${imageState === 'loading' ? 'is-loading' : ''}`} src={result.imageUrl} alt={`${result.headline} 포스터`} onLoad={() => setImageState('ready')} onError={() => setImageState('error')} />}
            {imageState === 'error' && <div className="marketing-result-empty"><ImageIcon size={30} /><h3>이미지를 불러오지 못했어요</h3><p>원본 보기에서 다시 확인해 주세요.</p></div>}
          </> : <div className="marketing-result-empty"><span className="marketing-result-symbol"><ImageIcon size={32} strokeWidth={1.4} /></span><h3>우리 가게의 다음 포스터</h3><p>상품 사진과 글귀를 넣으면<br />서로 다른 세 가지 디자인을 보여드릴게요.</p><div className="marketing-preview-tags"><span>상품 사진</span><b>+</b><span>가게의 소식</span></div></div>}
        </div>
        {draft?.imageProcessing.warning && <p className="marketing-mode-note" role="status">{draft.imageProcessing.warning}</p>}
        {result?.imageUrl && <><div className="marketing-result-actions"><button className="primary-button" onClick={() => void download()} disabled={downloading || working}>{downloading ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}{downloading ? '저장 준비 중' : '이미지 저장'}</button><a className="secondary-button" href={result.imageUrl} target="_blank" rel="noreferrer">원본 보기<ExternalLink size={15} /></a></div>
          {onRevise && <><label className="marketing-footer-toggle marketing-result-footer-toggle"><input type="checkbox" checked={draft.design.hide_footer ?? false} disabled={working || downloading} onChange={(event) => void revise(event.target.checked ? '하단 안내 숨기기' : '하단 안내 표시하기')} />선택한 시안의 하단 지역·문의 안내 숨기기</label><form className="marketing-revision" onSubmit={(event) => { event.preventDefault(); void revise() }}><label htmlFor="marketing-instruction">어떻게 바꾸고 싶으세요?</label><div><input id="marketing-instruction" maxLength={500} value={instruction} disabled={working} onChange={(event) => setInstruction(event.target.value)} placeholder="예: 배경은 초록색으로, 가격을 더 강조해줘" /><button className="primary-button" disabled={working || !instruction.trim()}>{revising ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}수정하기</button></div><div className="marketing-edit-presets">{['배경을 초록색으로 바꿔줘', '가격을 더 강조해줘', '제목을 고운돋움으로 바꿔줘'].map((text, index) => <button key={text} type="button" disabled={working} onClick={() => void revise(text)}>{['초록색으로', '가격 강조', '부드러운 글씨'][index]}</button>)}</div><small>상품·가격·기간 변경은 왼쪽 입력을 바꾸고 새 시안을 만들어 주세요.</small></form></>}
        </>}
        {downloadError && <p className="marketing-error" role="alert">{downloadError}</p>}
        {result && <div className="marketing-copy-result"><div><h3>함께 사용할 홍보 문구</h3><button aria-label="홍보 문구 복사" onClick={async () => { try { await navigator.clipboard.writeText(marketingCaption(result)); onToast('홍보 문구를 복사했어요.') } catch { onToast('복사 권한을 확인해 주세요.') } }}><Copy size={14} />복사</button></div><strong>{result.headline}</strong><p>{result.body}</p><div className="marketing-hashtags">{result.hashtags.map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</div></div>}
        <p className="marketing-result-note">1080 × 1350 PNG · 게시 전 글귀와 행사 정보를 확인해 주세요.</p>
      </section>
    </div>
  </div>
}
