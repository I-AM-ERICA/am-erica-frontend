export default function CustomerReplyOptions({ rating, storeInfo, requiredReplyText, disabled, onRating, onStoreInfo, onRequiredReplyText }: {
  rating: number; storeInfo: string; requiredReplyText: string; disabled: boolean
  onRating: (rating: number) => void; onStoreInfo: (storeInfo: string) => void
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
    <label htmlFor="store-info">가게 정보 <span>선택</span></label>
    <textarea id="store-info" value={storeInfo} maxLength={2000} rows={4} disabled={disabled}
      placeholder={'예: 누락·오배송은 배달앱 고객센터나 매장 전화로 알려 주시면 확인 후 다시 보내 드림\n영업 11:00~21:00, 월요일 휴무'}
      onChange={event => onStoreInfo(event.target.value)} />
    <p className="input-caption">배달·환불·연락 안내, 영업시간, 진행 중인 이벤트처럼 답글에 쓸 가게 정보를 한 줄에 하나씩 적어 주세요. 리뷰와 관련 있는 줄만 답글에 쓰이고, 메뉴 이름은 리뷰에 나온 것만 쓰여요. 이 브라우저에 저장돼서 다음에도 그대로 쓰여요.</p>
    <label htmlFor="required-reply-text">모든 답글에 넣을 문장 <span>선택</span></label>
    <input id="required-reply-text" type="text" value={requiredReplyText}
      maxLength={2000 - '필수: '.length} disabled={disabled}
      placeholder="예: 매주 월요일은 정기휴무입니다."
      onChange={event => onRequiredReplyText(event.target.value)} />
    <p className="input-caption">입력한 문장은 답글 끝에 들어가고, 이 브라우저에 가게별로 저장돼요.</p>
  </div>
  </>
}
