import { Sprout } from 'lucide-react'
import '../pages/styles/footer.css'

export default function Footer() {
  return <footer className="footer"><span>© {new Date().getFullYear()} 가게비서. 사장님의 일상에 여유를 더합니다.</span><span><Sprout size={13} /> 작은 가게의 든든한 내일</span></footer>
}
