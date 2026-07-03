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

type ReportKey = 'funnel' | 'source' | 'city' | 'recruiters'

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState<ReportKey | null>(null)

  const params = () => {
    const p: Record<string, string> = {}
    if (dateFrom) p.date_from = dateFrom
    if (dateTo) p.date_to = dateTo
    return p
  }

  useEffect(() => {
    api.get('/analytics', { params: params() }).then((r) => {
      const d = r.data
      setData({
        funnel: d.funnel ?? {},
        by_source: d.by_source ?? {},
        by_city: d.by_city ?? {},
        recruiters: d.recruiters ?? [],
        total_candidates: d.total_candidates ?? 0,
        total_hired: d.total_hired ?? 0,
        conversion: d.conversion ?? 0,
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  const exportReport = async (report: ReportKey) => {
    setExporting(report)
    try {
      const r = await api.get('/analytics/export', { params: { ...params(), report }, responseType: 'blob' })
      const blob = new Blob([r.data], { type: 'text/csv' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `analytics_${report}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setExporting(null)
    }
  }

  if (!data) return <LoadingState />

  const maxFunnel = Math.max(1, ...Object.values(data.funnel))

  return (
    <div>
      <PageHeader title="Аналитика" subtitle="Воронка, конверсия и эффективность рекрутеров" />

      <div className="card mb-6 flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Дата от</label>
          <input
            type="date"
            className="input"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Дата до</label>
          <input
            type="date"
            className="input"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {(dateFrom || dateTo) && (
          <button className="btn-outline" onClick={() => { setDateFrom(''); setDateTo('') }}>
            Сбросить период
          </button>
        )}
      </div>

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
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Воронка подбора</h3>
            <button className="btn-outline text-xs" disabled={exporting === 'funnel'} onClick={() => exportReport('funnel')}>
              {exporting === 'funnel' ? 'Экспорт…' : 'Экспорт CSV'}
            </button>
          </div>
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
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Источники кандидатов</h3>
            <button className="btn-outline text-xs" disabled={exporting === 'source'} onClick={() => exportReport('source')}>
              {exporting === 'source' ? 'Экспорт…' : 'Экспорт CSV'}
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(data.by_source).map(([src, n]) => (
              <div key={src} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{src}</span>
                <span className="badge bg-slate-100 text-slate-700">{n}</span>
              </div>
            ))}
            {Object.keys(data.by_source).length === 0 && <div className="text-sm text-slate-400">Нет данных</div>}
          </div>

          <div className="mb-3 mt-6 flex items-center justify-between">
            <h3 className="font-semibold">По городам</h3>
            <button className="btn-outline text-xs" disabled={exporting === 'city'} onClick={() => exportReport('city')}>
              {exporting === 'city' ? 'Экспорт…' : 'Экспорт CSV'}
            </button>
          </div>
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
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="font-semibold">Эффективность рекрутеров</h3>
          <button className="btn-outline text-xs" disabled={exporting === 'recruiters'} onClick={() => exportReport('recruiters')}>
            {exporting === 'recruiters' ? 'Экспорт…' : 'Экспорт CSV'}
          </button>
        </div>
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
