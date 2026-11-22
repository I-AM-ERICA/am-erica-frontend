export default function CustomerReplyOptions({ rating, storeInfo, requiredReplyText, disabled, onRating, onRequiredReplyText }: {
  rating: number; storeInfo: string; requiredReplyText: string; disabled: boolean
  onRating: (rating: number) => void
  onRequiredReplyText: (value: string) => void
}) {
  return <><div className="customer-reply-options">
    <div>
      <label htmlFor="review-rating">고객 별점 <span>선택</span></label>
      <select id="review-rating" value={rating} disabled={disabled} onChange={event => onRating(Number(event.target.value))}>
        <option value={0}>모름 / 선택 안 함</option>
        {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{'★'.repeat(value)} · {value}점</option>)}
      </select>
      <p className="input-caption">리뷰에 표시된 별점을 선택해 주세요. 모르면 비워 두셔도 돼요.</p>
    </div>
  </div>
  <div className="customer-store-info">
    <p className="input-caption">{storeInfo.trim() ? '저장된 가게 정보를 답글 작성에 참고해요.' : '영업시간이나 배달 안내를 저장하면 답글 작성에 참고해요.'} <a href="#settings">가게 정보 설정하기</a></p>
    <label htmlFor="required-reply-text">모든 답글에 넣을 문장 <span>선택</span></label>
    <input id="required-reply-text" type="text" value={requiredReplyText}
      maxLength={2000 - '필수: '.length} disabled={disabled}
      placeholder="예: 매주 월요일은 정기휴무입니다."
      onChange={event => onRequiredReplyText(event.target.value)} />
    <p className="input-caption">입력한 문장은 답글 끝에 들어가고, 이 브라우저에 가게별로 저장돼요.</p>
  </div>
  </>
}
