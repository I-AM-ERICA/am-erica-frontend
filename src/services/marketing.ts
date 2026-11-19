import { getAuthHeaders, logout } from './auth'
import type { StoreProfile } from '../types'

export const MAX_REFERENCE_BYTES = 5 * 1024 * 1024
export interface ReferenceImage { name: string; base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; previewUrl: string }
export interface MarketingRequest {
  product: string; message: string; tone: string; referenceImage: ReferenceImage
  styleReference?: ReferenceImage; logo?: ReferenceImage; price?: number; originalPrice?: number
  period?: string; contact?: string; hideFooter?: boolean; backgroundMode?: 'auto' | 'remove' | 'keep'
}
export interface MarketingDraft {
  id: string; version: number; result: MarketingResult; mode: 'demo' | 'clova'; width: number; height: number
  design: { template_id?: string; hide_footer?: boolean }; imageProcessing: { background?: string; warning?: string }
}
export interface MarketingDrafts { drafts: MarketingDraft[]; mode: 'demo' | 'clova' }
export type MarketingReviser = (draft: MarketingDraft, instruction: string, profile: StoreProfile, signal: AbortSignal) => Promise<MarketingDraft>
export interface MarketingResult { headline: string; body: string; hashtags: string[]; imageUrl: string | null }

export function imageMediaType(bytes: Uint8Array): ReferenceImage['mediaType'] | null {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return 'image/png'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}
export async function readReferenceImage(file: File): Promise<ReferenceImage> {
  if (!file.size || file.size > MAX_REFERENCE_BYTES) throw new Error('이미지는 5MB 이하로 올려 주세요.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mediaType = imageMediaType(bytes)
  if (!mediaType) throw new Error('JPG, PNG, WEBP 이미지 파일을 선택해 주세요.')
  const pieces: string[] = []
  for (let i = 0; i < bytes.length; i += 32768) pieces.push(String.fromCharCode(...bytes.subarray(i, i + 32768)))
  const base64 = btoa(pieces.join(''))
  return { name: file.name, mediaType, base64, previewUrl: `data:${mediaType};base64,${base64}` }
}
export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}
export function parseMarketingResult(value: unknown): MarketingResult {
  if (!value || typeof value !== 'object') throw new Error('카드뉴스 응답 형식이 올바르지 않아요.')
  const data = value as Record<string, unknown>
  if (typeof data.headline !== 'string' || typeof data.body !== 'string' || !Array.isArray(data.hashtags) || !data.hashtags.every((tag) => typeof tag === 'string')) throw new Error('카드뉴스 응답 형식이 올바르지 않아요.')
  if (data.imageUrl !== null && data.imageUrl !== undefined && data.imageUrl !== '' && !safeImageUrl(data.imageUrl)) throw new Error('카드뉴스 이미지 주소가 올바르지 않아요.')
  return { headline: data.headline, body: data.body, hashtags: data.hashtags.slice(0, 30), imageUrl: safeImageUrl(data.imageUrl) }
}
export type MarketingGenerator = (request: MarketingRequest, profile: StoreProfile, signal: AbortSignal) => Promise<MarketingDrafts>

export function marketingCaption(result: MarketingResult): string {
  return [result.headline, result.body, result.hashtags.join(' ')].filter(Boolean).join('\n\n')
}

export async function downloadMarketingImage(url: string, signal: AbortSignal): Promise<void> {
  const safeUrl = safeImageUrl(url)
  if (!safeUrl) throw new Error('이미지 주소를 확인해 주세요.')
  // Public result images never receive the app's login token or cookies.
  const response = await fetch(safeUrl, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error('이미지를 내려받지 못했어요. 원본 보기를 이용해 주세요.')
  const blob = await response.blob()
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) || blob.size > 20 * 1024 * 1024) throw new Error('원본 보기에서 이미지를 확인해 주세요.')
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `가게비서_카드뉴스.${blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1]}`
  document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}


export function parseMarketingDraft(value: unknown): MarketingDraft {
  if (!value || typeof value !== 'object') throw new Error('포스터 응답을 확인하지 못했어요.')
  const data = value as Record<string, unknown>
  if (typeof data.id !== 'string' || !data.id || !Number.isSafeInteger(data.version) || Number(data.version) < 1
    || !['demo', 'clova'].includes(String(data.mode)) || data.width !== 1080 || data.height !== 1350) throw new Error('포스터 응답을 확인하지 못했어요.')
  const result = parseMarketingResult(data.result)
  if (!result.imageUrl) throw new Error('생성된 포스터 이미지가 없어요.')
  const design = data.design as { template_id?: unknown; hide_footer?: unknown } | null
  const processing = data.imageProcessing as { background?: unknown; warning?: unknown } | null
  return { id: data.id, version: Number(data.version), result, mode: data.mode as 'demo' | 'clova', width: 1080, height: 1350,
    design: { template_id: typeof design?.template_id === 'string' ? design.template_id : undefined, hide_footer: design?.hide_footer === true },
    imageProcessing: { background: typeof processing?.background === 'string' ? processing.background : undefined,
      warning: typeof processing?.warning === 'string' ? processing.warning : undefined } }
}
export function parseMarketingDrafts(value: unknown): MarketingDrafts {
  const data = value as { drafts?: unknown; mode?: unknown } | null
  if (!data || !Array.isArray(data.drafts) || data.drafts.length !== 3 || !['demo', 'clova'].includes(String(data.mode))) throw new Error('세 가지 시안을 받지 못했어요.')
  return { drafts: data.drafts.map(parseMarketingDraft), mode: data.mode as 'demo' | 'clova' }
}
export class MarketingConflict extends Error {}
function promotionPath(profile: StoreProfile) {
  if (!Number.isSafeInteger(profile.id) || profile.id! <= 0) throw new Error('가게 정보를 먼저 저장해 주세요.')
  return `/api/stores/${profile.id}/ai/promotion/drafts`
}
async function promotionRequest(path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', signal,
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) })
  if (response.status === 401) { logout(); throw new Error('로그인이 만료되었어요. 다시 로그인해 주세요.') }
  if (response.status === 409) throw new MarketingConflict('최신 시안을 불러왔어요. 내용을 확인한 뒤 다시 수정해 주세요.')
  if (!response.ok) {
    const messages: Record<number, string> = { 400: '사진 형식, 문구 길이와 가격을 확인해 주세요. 가격·상품 변경은 새로 만들기를 이용해 주세요.',
      403: '이 가게의 포스터를 수정할 권한이 없어요.', 404: '포스터를 찾지 못했어요. 새로 만들어 주세요.',
      429: '요청이 많거나 AI 이용 한도에 도달했어요. 잠시 후 다시 시도해 주세요.', 503: '홍보 비서 서버에 연결하지 못했어요.', 504: '포스터 제작 시간이 초과됐어요. 다시 시도해 주세요.' }
    throw new Error(messages[response.status] || '포스터를 만들지 못했어요. 홍보 서버 연결과 API 설정을 확인해 주세요.')
  }
  return response.json()
}
export function marketingPayload(request: MarketingRequest) {
  const image = (value?: ReferenceImage) => value ? { base64: value.base64, mediaType: value.mediaType } : undefined
  return { product: request.product.trim(), message: request.message.trim(), tone: request.tone, channel: 'instagram', generateImage: true,
    productImage: image(request.referenceImage), styleReference: image(request.styleReference), logo: image(request.logo),
    price: request.price, originalPrice: request.originalPrice, period: request.period, contact: request.contact, hideFooter: request.hideFooter ?? false, backgroundMode: request.backgroundMode || 'auto' }
}
export const generateMarketing: MarketingGenerator = async (request, profile, signal) =>
  parseMarketingDrafts(await promotionRequest(promotionPath(profile), signal, marketingPayload(request)))
export const reviseMarketing: MarketingReviser = async (draft, instruction, profile, signal) =>
  parseMarketingDraft(await promotionRequest(`${promotionPath(profile)}/${encodeURIComponent(draft.id)}/revisions`, signal,
    { instruction: instruction.trim(), expectedVersion: draft.version }))
export async function getMarketingDraft(id: string, profile: StoreProfile, signal: AbortSignal): Promise<MarketingDraft> {
  return parseMarketingDraft(await promotionRequest(`${promotionPath(profile)}/${encodeURIComponent(id)}`, signal))
}
