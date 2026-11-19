import { ChartNoAxesCombined, FileText, Megaphone, MessagesSquare } from 'lucide-react'
import type { AssistantId, Activity } from './types'

export const assistants = [
  { id: 'policy' as const, name: '정책 비서', label: '놓치지 마세요', title: '우리 가게에 딱 맞는 지원 정책', description: '복잡한 지원사업, 이제 쉽게 찾아보세요.\n우리 가게에 필요한 정책을 알려드려요.', icon: FileText, color: 'green', action: '맞춤 정책 찾기', tag: '정책 · 지원금' },
  { id: 'marketing' as const, name: '홍보 비서', label: '가게의 매력을 더 널리', title: '눈길을 끄는 우리 가게 홍보', description: '참고 이미지와 전하고 싶은 글귀로,\n우리 가게만의 카드뉴스를 만들어요.', icon: Megaphone, color: 'orange', action: '홍보 콘텐츠 만들기', tag: '카드뉴스 · 홍보 문구' },
  { id: 'customer' as const, name: '고객응대 비서', label: '마음을 전하는 답장', title: '리뷰마다 정성을 담은 답글', description: '고객이 남긴 리뷰를 넣어 주세요.\n우리 가게에 맞는 답글 초안을 준비해 드려요.', icon: MessagesSquare, color: 'blue', action: '리뷰 답글 작성하기', tag: '리뷰 · 답글' },
  { id: 'sales' as const, name: '경영 비서', label: '숫자에서 찾는 다음 기회', title: '미리 살펴보는 우리 가게 매출', description: '일별 매출을 입력하고,\n다가올 매출을 예측해 보세요.', icon: ChartNoAxesCombined, color: 'purple', action: '매출 예측하기', tag: '일별 매출 · 예측' },
]

export function getAssistant(id: AssistantId) {
  return assistants.find((assistant) => assistant.id === id)!
}

export const initialActivities: Activity[] = [
  { id: 'example-1', assistant: 'marketing', title: '신메뉴 출시 인스타그램 콘텐츠', description: '카드뉴스 문안 · 5장', createdAt: '', content: '[예시 콘텐츠]\n1. 오늘의 작은 행복, 새로 나온 딸기 라떼\n2. 제철 딸기를 듬뿍 담았어요.\n3. 부드러운 우유와 달콤한 딸기의 만남\n4. 잠깐의 여유가 필요할 때 들러주세요.\n5. 우리 가게에서 만나요!' },
  { id: 'example-2', assistant: 'customer', title: '방문 고객 리뷰 답글 작성', description: '리뷰 답글 · 따뜻한 말투', createdAt: '', content: '[예시 답글]\n소중한 시간 내어 방문해 주셔서 감사합니다. 편안한 시간을 보내셨다니 저희도 기쁩니다. 다음 방문에도 정성껏 준비해서 맞이하겠습니다. 좋은 하루 보내세요!' },
  { id: 'example-3', assistant: 'sales', title: '지난주 매출 분석 리포트', description: '주간 매출 · 피크타임 분석', createdAt: '', content: '[예시 리포트]\n지난주 총매출: 2,450,000원\n가장 바쁜 시간: 오후 12시~2시\n운영 제안: 점심시간 전에 재료를 미리 준비하고, 주문이 적은 오후에는 세트 메뉴 홍보를 시도해 보세요.\n이 결과는 실제 매장 데이터가 아닌 화면 체험용 예시입니다.' },
]
