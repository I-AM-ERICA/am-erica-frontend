export interface PostcodeData {
  userSelectedType: string
  roadAddress: string
  jibunAddress: string
  address: string
  sido: string
  sigungu: string
}
interface PostcodeOptions {
  oncomplete: (data: PostcodeData) => void
  onresize: () => void
  width: string
  height: string
}
type PostcodeConstructor = new (options: PostcodeOptions) => { embed: (element: HTMLElement) => void }
type PostcodeWindow = Window & { kakao?: { Postcode?: PostcodeConstructor }; daum?: { Postcode?: PostcodeConstructor } }
const sdk = () => (window as PostcodeWindow).kakao?.Postcode ?? (window as PostcodeWindow).daum?.Postcode
let loading: Promise<PostcodeConstructor> | null = null

export function selectedAddress(data: PostcodeData): { address: string; region: string } {
  const address = (data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress)?.trim() || data.address?.trim()
  const region = [data.sido?.trim(), data.sigungu?.trim()].filter(Boolean).join(' ')
  if (!address || !data.sido?.trim() || address.length > 255 || region.length > 50) {
    throw new Error('선택한 주소를 확인하지 못했어요. 다른 검색 결과를 선택해 주세요.')
  }
  return { address, region }
}

export function loadPostcode(): Promise<PostcodeConstructor> {
  const existing = sdk()
  if (existing) return Promise.resolve(existing)
  if (loading) return loading
  loading = new Promise<PostcodeConstructor>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    const fail = () => {
      window.clearTimeout(timer); script.remove(); loading = null
      reject(new Error('주소 검색을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'))
    }
    const timer = window.setTimeout(fail, 15000)
    script.onerror = fail
    script.onload = () => {
      const Postcode = sdk()
      if (!Postcode) { fail(); return }
      window.clearTimeout(timer); resolve(Postcode)
    }
    document.head.append(script)
  })
  return loading
}
