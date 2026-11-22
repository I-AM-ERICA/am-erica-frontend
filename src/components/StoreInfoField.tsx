import './StoreInfoField.css'

export default function StoreInfoField({ value, onChange, disabled = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean
}) {
  return <div className="store-guide-field">
    <label htmlFor="store-info">답글에 참고할 가게 정보 <span>선택</span></label>
    <textarea id="store-info" value={value} onChange={event => onChange(event.target.value)}
      disabled={disabled} maxLength={2000} rows={5} aria-describedby="store-info-help"
      placeholder={'예: 영업 11:00~21:00, 월요일 휴무\n누락·오배송은 배달앱 고객센터로 알려 주시면 확인해 드려요.'} />
    <p id="store-info-help">영업시간, 배달·환불 안내, 이벤트 등 알려 주실 내용이 있으면 적어 주세요. 고객 응대 비서가 답글에 참고해요. 지금은 건너뛰고 나중에 가게 설정에서 추가하거나 수정할 수 있어요.</p>
    <span className="store-guide-count">{value.length.toLocaleString()} / 2,000자</span>
  </div>
}
