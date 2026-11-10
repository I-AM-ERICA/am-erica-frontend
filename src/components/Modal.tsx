import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import './modal.css'

export default function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    const cancel = (event: Event) => { event.preventDefault(); close.current() }
    dialog?.addEventListener('cancel', cancel)
    return () => { dialog?.removeEventListener('cancel', cancel); dialog?.close() }
  }, [])
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onClick={(event) => { if (event.target === ref.current) onClose() }}><div className="modal-inner"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></div>{children}</div></dialog>
}
