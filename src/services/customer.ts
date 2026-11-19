import { getAuthHeaders, logout } from './auth'
import type { AssistantResult, StoreProfile } from '../types'

export async function draftCustomerReply(review: string, profile: StoreProfile, signal?: AbortSignal): Promise<AssistantResult> {
  if (!Number.isSafeInteger(profile.id) || profile.id! <= 0) throw new Error('가게 정보를 먼저 저장해 주세요.')
  const reviewText = review.trim()
  if (!reviewText || reviewText.length > 2000) throw new Error('고객 리뷰를 1~2,000자로 입력해 주세요.')
  const response = await fetch(`/api/stores/${profile.id}/ai/customer/reply`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ reviewText, tone: '정중하고 따뜻하게' }), signal,
  })
  if (response.status === 401) { logout(); throw new Error('로그인이 만료되었어요. 다시 로그인해 주세요.') }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: '리뷰 내용을 확인해 주세요. 최대 2,000자까지 입력할 수 있어요.',
      403: '이 가게의 리뷰 답글을 만들 권한이 없어요.',
      404: '가게 정보를 찾지 못했어요. 가게 설정을 확인해 주세요.',
      429: '고객응대 비서가 다른 요청을 처리하고 있어요. 잠시 후 다시 시도해 주세요.',
      503: '고객응대 비서에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
      504: '답글 생성 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.',
    }
    throw new Error(messages[response.status] || '답글을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('reply' in data) || typeof data.reply !== 'string' || !data.reply.trim()) {
    throw new Error('답글을 받지 못했어요. 다시 시도해 주세요.')
  }
  return { text: data.reply.trim() }
}
