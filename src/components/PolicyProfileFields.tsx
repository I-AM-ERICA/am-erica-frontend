import type { PolicyProfileDraft } from '../services/policy-profile'
import { policyProfileLimits } from '../services/policy-profile'
import './PolicyProfileFields.css'

export default function PolicyProfileFields({ value, onChange, disabled = false }: {
  value: PolicyProfileDraft; onChange: (value: PolicyProfileDraft) => void; disabled?: boolean
}) {
  return <fieldset className="policy-profile-fields" disabled={disabled}>
    <legend>맞춤 정책을 위한 가게 정보</legend>
    <p className="input-caption">정책 비서가 지원 대상에 맞는 공고를 찾을 때 참고해요. 나이는 만 나이로 입력해 주세요.</p>
    <div className="policy-profile-grid">
      <label htmlFor="policy-region">운영 지역 <span>필수</span>
        <input id="policy-region" value={value.region} required maxLength={50} pattern=".*\S.*" placeholder="예: 경기도 안산시 상록구"
          onChange={event => onChange({ ...value, region: event.target.value })} />
      </label>
      <label htmlFor="policy-owner-age">사장님 나이 (만 나이) <span>필수</span>
        <input id="policy-owner-age" type="number" min={1} max={policyProfileLimits.ownerAge} step={1} required value={value.ownerAge} placeholder="예: 35"
          onChange={event => onChange({ ...value, ownerAge: event.target.value })} />
      </label>
      <label htmlFor="policy-employees">직원 수 (명) <span>필수</span>
        <input id="policy-employees" type="number" min={0} max={policyProfileLimits.employeeCount} step={1} required value={value.employeeCount} placeholder="혼자 운영하면 0"
          onChange={event => onChange({ ...value, employeeCount: event.target.value })} />
      </label>
      <label htmlFor="policy-revenue">월 매출 (원) <span>선택</span>
        <input id="policy-revenue" type="number" min={0} max={policyProfileLimits.monthlyRevenue} step={1} value={value.monthlyRevenue} placeholder="예: 10000000"
          onChange={event => onChange({ ...value, monthlyRevenue: event.target.value })} />
      </label>
    </div>
    <p className="input-caption">직원 수는 사장님을 제외하고 적어 주세요. 월 매출은 비워 두어도 돼요. 설정에서 언제든 수정할 수 있어요.</p>
  </fieldset>
}
