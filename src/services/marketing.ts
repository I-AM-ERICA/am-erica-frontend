import type { StoreProfile } from '../types'

export const MAX_REFERENCE_BYTES = 5 * 1024 * 1024
export interface ReferenceImage { name: string; base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; previewUrl: string }
export interface MarketingRequest { product: string; message: string; tone: string; referenceImage: ReferenceImage }
export interface MarketingResult { headline: string; body: string; hashtags: string[]; imageUrl: string | null }

export function imageMediaType(bytes: Uint8Array): ReferenceImage['mediaType'] | null {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return 'image/png'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}
export async function readReferenceImage(file: File): Promise<ReferenceImage> {
  if (!file.size || file.size > MAX_REFERENCE_BYTES) throw new Error('참고 이미지는 5MB 이하로 올려 주세요.')
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
// Supply this adapter to MarketingPage once the trained model's API is agreed.
export type MarketingGenerator = (request: MarketingRequest, profile: StoreProfile, signal: AbortSignal) => Promise<MarketingResult>

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
