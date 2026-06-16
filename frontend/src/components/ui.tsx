import { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  open, onClose, title, children, width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className={`card w-full ${width} my-8`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Empty({ text }: { text: string }) {
  return <div className="card p-10 text-center text-sm text-slate-400">{text}</div>
}

export function LoadingState({ text = 'Загрузка…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {text}
    </div>
  )
}
