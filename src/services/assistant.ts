import { apiFetch } from './api'
import { getAuthHeaders, logout } from './auth'
import { draftCustomerReply } from './customer'
import type { AssistantId, AssistantResult, StoreProfile } from '../types'

export const isLiveMode = import.meta.env.VITE_API_MODE === 'live'

export interface AssistantRequest {
  message: string
  rating?: number
  tone?: string
  storeInfo?: string
  format: string
  profile: StoreProfile
}

export function analyzeSalesCsv(csv: string): string {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell.trim()); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i++
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''
    } else cell += char
  }
  if (quoted) throw new Error('CSV의 따옴표가 닫히지 않았습니다. 파일 형식을 확인해 주세요.')
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row)
  const headers = rows.shift()?.map((value) => value.replace(/^\uFEFF/, '').toLowerCase())
  if (!headers || rows.length === 0) throw new Error('분석할 매출 내역이 없어요. 제목 행과 매출 내역을 넣어 주세요.')
  const amountIndex = headers.findIndex((value) => ['매출', '매출액', 'amount', 'sales'].includes(value))
  const dateIndex = headers.findIndex((value) => ['날짜', 'date', '일시', 'datetime'].includes(value))
  const hourIndex = headers.findIndex((value) => ['시간', 'hour'].includes(value))
  if (amountIndex < 0) throw new Error('CSV에 매출 또는 amount 열이 필요해요.')
  const daily: Record<string, number> = {}, hourly: Record<string, number> = {}
  let total = 0
  rows.forEach((record, index) => {
    const raw = record[amountIndex]?.replace(/[,₩원\s]/g, '')
    const amount = raw ? Number(raw) : NaN
    if (!Number.isFinite(amount)) throw new Error(`${index + 2}행의 매출이 숫자가 아니에요. 파일을 확인해 주세요.`)
    total += amount
    if (dateIndex >= 0 && record[dateIndex]) { const date = record[dateIndex].split(/[T ]/)[0]; daily[date] = (daily[date] ?? 0) + amount }
    if (hourIndex >= 0 && record[hourIndex]) {
      const hour = Number(record[hourIndex].split(':')[0])
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error(`${index + 2}행의 시간은 0~23 또는 HH:mm 형식으로 입력해 주세요.`)
      hourly[hour] = (hourly[hour] ?? 0) + amount
    }
  })
  const bestDay = Object.entries(daily).sort((a, b) => b[1] - a[1])[0]
  const peak = Object.entries(hourly).sort((a, b) => b[1] - a[1])[0]
  const money = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`
  return `업로드한 매출 데이터 분석\n\n총매출: ${money(total)}\n매출 내역: ${rows.length.toLocaleString()}건\n내역 1건당 평균 매출: ${money(total / rows.length)}${bestDay ? `\n매출이 가장 높은 날: ${bestDay[0]} (${money(bestDay[1])})\n일평균 매출: ${money(total / Object.keys(daily).length)}` : ''}${peak ? `\n매출이 가장 높은 시간: ${peak[0]}시 (${money(peak[1])})` : ''}\n\n운영에 이렇게 활용해 보세요\n${peak ? `${peak[0]}시 매출이 가장 높습니다. 해당 시간 전후의 주문 건수와 근무 인원을 함께 살펴보세요.` : '시간 열을 추가하면 매출이 가장 높은 시간도 확인할 수 있어요.'}\n식재료 원가와 인건비는 이 분석에 포함되지 않았어요. 매출과 비용을 함께 검토하면 수익성을 더 정확히 파악할 수 있습니다.\n\n이 결과는 업로드한 데이터의 합계와 평균으로 계산했으며, AI 예측이 아닙니다.`
}

function demoResult(id: AssistantId, request: AssistantRequest): AssistantResult {
  const { message, format, profile } = request
  if (id === 'policy') return {
    text: `정책 탐색을 위한 준비 가이드\n\n${profile.region}에서 ${profile.category} 가게를 운영하고 계시군요.\n문의 내용: ${message}\n\n아래 항목부터 확인해 보세요.\n\n1. 소상공인 정책자금\n운영자금이나 시설자금 관련 사업을 찾으실 때 살펴볼 수 있어요.\n\n2. 지역별 소상공인 지원사업\n사업장 주소를 기준으로 지자체 공고를 확인해 보세요.\n\n3. 디지털 전환·판로 지원\n온라인 홍보, 주문 시스템, 판매 채널 확대에 관련된 공고를 살펴보세요.\n\n확인할 준비물\n사업자등록증, 사업장 소재지, 개업일, 매출 및 상시 근로자 정보를 준비해 주세요.\n\n이 답변은 체험용 안내입니다. 현재 모집 중인 공고나 지원 자격을 조회한 결과가 아닙니다. 아래 공식 사이트에서 최신 공고와 접수 기간을 확인해 주세요.`,
    sources: [{ title: '소상공인24 공식 사이트', url: 'https://www.sbiz24.kr/' }, { title: '기업마당 공식 사이트', url: 'https://www.bizinfo.go.kr/' }],
  }
  if (id === 'marketing') return { text: format === '숏폼 기획' ? `15초 숏폼 기획 초안 · ${profile.name}\n\n주제: ${message}\n\n0~3초 | 시선을 끄는 첫 장면\n가게 입구나 대표 메뉴를 가까이 담아 주세요.\n자막: “오늘은 나를 위한 작은 선물”\n\n3~8초 | 준비하는 손길\n재료를 준비하거나 제품이 완성되는 장면을 담아요.\n자막: “${profile.name}에서 정성껏 준비했어요”\n\n8~12초 | 가장 매력적인 순간\n완성된 메뉴나 공간을 따뜻한 빛 아래 보여 주세요.\n자막: “일상 속 반가운 쉼표”\n\n12~15초 | 방문 안내\n가게 이름, 실제 영업시간과 위치를 넣어 주세요.\n자막: “${profile.name}에서 만나요”\n\n직접 촬영할 때는 세로 화면(9:16)을 권장해요.\n체험용 기획 템플릿이며 영상 파일은 생성되지 않습니다.` : `${format} 문안 초안 · ${profile.name}\n\n홍보 주제: ${message}\n\n${format === '카드뉴스 문안' ? '1장 · 표지\n' : ''}오늘의 일상에, 작은 즐거움 하나.\n${profile.name}에서 반가운 소식을 전해요.\n\n${format === '카드뉴스 문안' ? '2장 · 소개\n' : ''}${message}\n사장님의 정성과 가게만의 매력을 담아 준비했어요.\n\n${format === '카드뉴스 문안' ? '3장 · 매력 포인트\n' : ''}바쁜 하루 중 잠깐, 편안하게 들러 주세요.\n익숙한 일상에 기분 좋은 변화를 더해 드릴게요.\n\n${format === '카드뉴스 문안' ? '4장 · 방문 안내\n' : ''}${profile.region}, ${profile.name}에서 만나요.\n실제 영업시간과 행사 기간을 여기에 추가해 주세요.\n\n${format === '카드뉴스 문안' ? '5장 · 마무리\n' : ''}함께 오고 싶은 분에게 이 소식을 전해 주세요.\n\n#${profile.name.replace(/\s/g, '')} #동네가게 #오늘의소식\n\n체험용 문안 템플릿입니다. 이미지·영상 생성은 백엔드 연결 후 제공할 수 있습니다.` }
  return { text: analyzeSalesCsv(message) }
}

export async function runAssistant(id: AssistantId, request: AssistantRequest, signal?: AbortSignal): Promise<AssistantResult> {
  if (id === 'customer') return draftCustomerReply(request.message, request.profile, signal, { rating: request.rating, tone: request.tone, storeInfo: request.storeInfo })
  if (!isLiveMode) return demoResult(id, request)
  const response = await apiFetch(`/api/assistants/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(request), signal })
  if (response.status === 401) { logout(); throw new Error('로그인이 만료되었어요. 다시 로그인해 주세요.') }
  if (!response.ok) throw new Error(`비서 연결에 실패했어요 (${response.status}). 잠시 후 다시 시도해 주세요.`)
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('text' in data) || typeof data.text !== 'string') throw new Error('서버 응답 형식이 올바르지 않아요.')
  const sources: AssistantResult['sources'] = []
  if ('sources' in data && Array.isArray(data.sources)) for (const source of data.sources) {
    if (source && typeof source.title === 'string' && typeof source.url === 'string' && /^https?:\/\//.test(source.url)) sources.push({ title: source.title, url: source.url })
  }
  return { text: data.text, sources }
}
