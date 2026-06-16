import { useEffect, useState } from 'react'
import api from '../api'
import { STAGES, stageLabel } from '../types'
import { PageHeader, LoadingState } from '../components/ui'
import { MetricCard } from '../components/MetricCard'

interface AnalyticsData {
  funnel: Record<string, number>
  by_source: Record<string, number>
  by_city: Record<string, number>
  recruiters: { id: number; name: string; candidates: number; hired: number; conversion: number }[]
  conversion: number
  total_candidates: number
  total_hired: number
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    api.get('/analytics').then((r) => {
      const d = r.data
      // API returns arrays [{stage,count}], [{source,count}], [{city,count}]
      // Normalize to Record<string, number> that the component expects
      const funnel: Record<string, number> = {}
      ;(d.funnel ?? []).forEach((x: any) => { funnel[x.stage] = x.count })

      const by_source: Record<string, number> = {}
      ;(d.by_source ?? []).forEach((x: any) => { by_source[x.source] = x.count })

      const by_city: Record<string, number> = {}
      ;(d.by_city ?? []).forEach((x: any) => { by_city[x.city] = x.count })

      const recruiters = (d.recruiters ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        candidates: r.total ?? r.candidates ?? 0,
        hired: r.hired ?? 0,
        conversion: r.conversion ?? 0,
      }))

      setData({
        funnel,
        by_source,
        by_city,
        recruiters,
        total_candidates: d.totals?.total ?? d.total_candidates ?? 0,
        total_hired: d.totals?.hired ?? d.total_hired ?? 0,
        conversion: d.totals?.conversion ?? d.conversion ?? 0,
      })
    })
  }, [])
  if (!data) return <LoadingState />

  const maxFunnel = Math.max(1, ...Object.values(data.funnel))

  return (
    <div>
      <PageHeader title="Аналитика" subtitle="Воронка, конверсия и эффективность рекрутеров" />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Всего кандидатов', value: data.total_candidates },
          { label: 'Нанято', value: data.total_hired },
          { label: 'Конверсия в найм', value: `${data.conversion}%` },
        ].map((c) => (
          <MetricCard key={c.label} label={c.label} value={c.value} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 font-semibold">Воронка подбора</h3>
          <div className="space-y-3">
            {STAGES.map((s) => {
              const val = data.funnel[s.value] ?? 0
              return (
                <div key={s.value}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-600">{s.label}</span>
                    <span className="font-medium">{val}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${(val / maxFunnel) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 font-semibold">Источники кандидатов</h3>
          <div className="space-y-2">
            {Object.entries(data.by_source).map(([src, n]) => (
              <div key={src} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{src}</span>
                <span className="badge bg-slate-100 text-slate-700">{n}</span>
              </div>
            ))}
            {Object.keys(data.by_source).length === 0 && <div className="text-sm text-slate-400">Нет данных</div>}
          </div>

          <h3 className="mb-3 mt-6 font-semibold">По городам</h3>
          <div className="space-y-2">
            {Object.entries(data.by_city).map(([city, n]) => (
              <div key={city} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{city}</span>
                <span className="badge bg-slate-100 text-slate-700">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <h3 className="border-b border-slate-200 px-5 py-3.5 font-semibold">Эффективность рекрутеров</h3>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Рекрутер</th>
              <th className="px-5 py-3 font-medium">Кандидатов</th>
              <th className="px-5 py-3 font-medium">Нанято</th>
              <th className="px-5 py-3 font-medium">Конверсия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.recruiters.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-3 font-medium">{r.name}</td>
                <td className="px-5 py-3 text-slate-500">{r.candidates}</td>
                <td className="px-5 py-3 text-slate-500">{r.hired}</td>
                <td className="px-5 py-3"><span className="badge bg-emerald-50 text-emerald-700">{r.conversion}%</span></td>
              </tr>
            ))}
            {data.recruiters.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">Нет данных</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
