export default function CustomerReplyOptions({ rating, tone, disabled, onRating, onTone }: {
  rating: number; tone: string; disabled: boolean
  onRating: (rating: number) => void; onTone: (tone: string) => void
}) {
  return <div className="customer-reply-options">
    <div>
      <label htmlFor="review-rating">고객 별점 <span>선택</span></label>
      <select id="review-rating" value={rating} disabled={disabled} onChange={event => onRating(Number(event.target.value))}>
        <option value={0}>모름 / 선택 안 함</option>
        {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{'★'.repeat(value)} · {value}점</option>)}
      </select>
      <p className="input-caption">리뷰에 표시된 별점을 선택해 주세요. 모르면 비워 두셔도 돼요.</p>
    </div>
    <div>
      <label htmlFor="reply-tone">답글 말투 <span>선택</span></label>
      <input id="reply-tone" list="reply-tone-suggestions" value={tone} maxLength={30} disabled={disabled}
        placeholder="예: 친근하게" onChange={event => onTone(event.target.value)} />
      <datalist id="reply-tone-suggestions">
        <option value="정중하고 따뜻하게" /><option value="친근하게" /><option value="차분하고 간결하게" />
      </datalist>
      <p className="input-caption">원하는 말투를 30자 이내로 알려주세요.</p>
    </div>
  </div>
}
