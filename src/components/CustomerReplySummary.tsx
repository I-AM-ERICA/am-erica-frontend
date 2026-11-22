import type { AssistantResult } from '../types'

const labels = { positive: '긍정', neutral: '중립', negative: '부정' }

export default function CustomerReplySummary({ result }: { result: NonNullable<AssistantResult['customer']> }) {
  return <div className="customer-reply-summary">
    <p>{result.rating === 0 ? '별점 미입력' : `고객 별점 ${result.rating}점`}
      {result.rating > 0 && result.sentiment && <> · 별점 기준 {labels[result.sentiment]}</>}
    </p>
    <p>리뷰 주제: {result.keywords.length ? result.keywords.join(' · ') : '확인된 주제 없음'}</p>
  </div>
}
