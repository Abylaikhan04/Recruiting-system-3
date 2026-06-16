import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase, Users, CalendarCheck, UserCheck, Clock, ClipboardList, ArrowRight,
} from 'lucide-react'
import api from '../api'
import { Candidate, Meeting, stageColor, stageLabel } from '../types'
import { PageHeader, LoadingState } from '../components/ui'
import { MetricCard } from '../components/MetricCard'

interface DashData {
  metrics: {
    open_vacancies: number
    candidates: number
    interviews_today: number
    hired_this_month: number
    pending_requests: number
  }
  upcoming_meetings: Meeting[]
  recent_candidates: Candidate[]
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'идёт сейчас'
  const min = Math.round(diff / 60000)
  if (min < 60) return `через ${min} мин`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return `через ${h} ч ${m} мин`
  return `через ${Math.round(h / 24)} дн`
}

export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null)

  useEffect(() => {
    api.get<DashData>('/dashboard').then((r) => setData(r.data))
  }, [])

  if (!data) return <LoadingState />

  const cards = [
    { label: 'Открытые вакансии', value: data.metrics.open_vacancies, icon: Briefcase, color: 'text-brand-600 bg-brand-50', to: '/vacancies' },
    { label: 'Кандидатов', value: data.metrics.candidates, icon: Users, color: 'text-violet-600 bg-violet-50', to: '/candidates' },
    { label: 'Интервью сегодня', value: data.metrics.interviews_today, icon: CalendarCheck, color: 'text-amber-600 bg-amber-50', to: '/meetings' },
    { label: 'Нанято в месяц', value: data.metrics.hired_this_month, icon: UserCheck, color: 'text-emerald-600 bg-emerald-50', to: '/candidates?stage=hired' },
  ]

  return (
    <div>
      <PageHeader title="Главная" subtitle="Обзор подбора персонала Alina Group" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <MetricCard key={c.label} label={c.label} value={c.value} icon={c.icon} iconClass={c.color} to={c.to} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h3 className="font-semibold">Последние изменения кандидатов</h3>
            <Link to="/candidates" className="text-sm text-brand-600 hover:underline">Все кандидаты</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recent_candidates.map((c) => (
              <Link to={`/candidates/${c.id}`} key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                  {c.full_name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.full_name}</div>
                  <div className="text-xs text-slate-400">{c.position} · {c.city}</div>
                </div>
                <span className={`badge ${stageColor(c.stage)}`}>{stageLabel(c.stage)}</span>
              </Link>
            ))}
            {data.recent_candidates.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Нет кандидатов</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h3 className="font-semibold">Ближайшие встречи</h3>
            <Link to="/meetings" className="text-sm text-brand-600 hover:underline">Все</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.upcoming_meetings.map((m) => (
              <div key={m.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{m.title}</div>
                  <span className="badge bg-brand-50 text-brand-700 whitespace-nowrap">
                    <Clock size={12} className="mr-1" /> {timeUntil(m.starts_at)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {new Date(m.starts_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                  {m.location ? ` · ${m.location}` : ''}
                </div>
              </div>
            ))}
            {data.upcoming_meetings.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Нет запланированных встреч</div>
            )}
          </div>

          {data.metrics.pending_requests > 0 && (
            <Link to="/requests" className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-amber-700 hover:bg-amber-50">
              <span className="flex items-center gap-2"><ClipboardList size={16} /> Заявки на подбор: {data.metrics.pending_requests} новых</span>
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
