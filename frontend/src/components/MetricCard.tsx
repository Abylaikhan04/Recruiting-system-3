import type { ElementType } from 'react'
import { Link } from 'react-router-dom'

interface MetricCardProps {
  label: string
  value: number | string
  icon?: ElementType
  iconClass?: string
  to?: string
}

export function MetricCard({ label, value, icon: Icon, iconClass, to }: MetricCardProps) {
  const inner = (
    <>
      {Icon && (
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${iconClass ?? 'text-brand-600 bg-brand-50'}`}>
          <Icon size={20} />
        </div>
      )}
      <div className={Icon ? 'mt-4 text-3xl font-semibold' : 'text-3xl font-semibold'}>{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </>
  )

  if (to) {
    return (
      <Link to={to} className="card p-5 block transition-shadow hover:shadow-md hover:border-brand-200">
        {inner}
      </Link>
    )
  }

  return <div className="card p-5">{inner}</div>
}
