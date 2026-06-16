import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Table2, Search, ChevronDown } from 'lucide-react'
import api from '../api'
import { Candidate, STAGES, Stage, stageColor } from '../types'
import { PageHeader } from '../components/ui'

interface Vacancy { id: number; title: string }
interface CtxMenu { x: number; y: number; candidate: Candidate }

export default function Funnel() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [vacancyId, setVacancyId] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [dragId, setDragId] = useState<number | null>(null)
  const [ctx, setCtx] = useState<CtxMenu | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)

  const load = () => {
    const params: Record<string, string | number> = { per_page: 500 }
    if (vacancyId) params.vacancy_id = vacancyId
    api.get('/candidates', { params }).then((r) => setCandidates(r.data.data ?? []))
  }

  useEffect(load, [vacancyId])
  useEffect(() => {
    api.get<Vacancy[]>('/vacancies').then((r) => setVacancies(r.data))
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtx(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const move = async (id: number, stage: Stage) => {
    setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, stage } : c)))
    setCtx(null)
    await api.put(`/candidates/${id}`, { stage })
  }

  const remove = async (id: number) => {
    if (!confirm('Удалить кандидата?')) return
    setCtx(null)
    await api.delete(`/candidates/${id}`)
    setCandidates((cs) => cs.filter((c) => c.id !== id))
  }

  const filtered = candidates.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.full_name.toLowerCase().includes(q) || c.position.toLowerCase().includes(q)
  })

  const openCtx = (e: React.MouseEvent, candidate: Candidate) => {
    e.preventDefault()
    setCtx({ x: e.clientX, y: e.clientY, candidate })
  }

  return (
    <div>
      <PageHeader title="Воронка подбора" subtitle={`${filtered.length} кандидатов`} />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Поиск по ФИО или должности…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="relative">
          <select
            className="input w-52 text-sm appearance-none pr-8"
            value={vacancyId}
            onChange={(e) => setVacancyId(e.target.value)}
          >
            <option value="">Все вакансии</option>
            {vacancies.map((v) => (
              <option key={v.id} value={String(v.id)}>{v.title}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-200">
          <button
            className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'kanban' ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setView('kanban')}
          >
            <LayoutGrid size={15} /> Канбан
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'table' ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setView('table')}
          >
            <Table2 size={15} /> Таблица
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <KanbanView candidates={filtered} dragId={dragId} setDragId={setDragId} move={move} openCtx={openCtx} />
      ) : (
        <TableView candidates={filtered} move={move} openCtx={openCtx} />
      )}

      {/* Context menu */}
      {ctx && (
        <div
          ref={ctxRef}
          style={{ position: 'fixed', top: ctx.y, left: ctx.x, zIndex: 9999 }}
          className="w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          <div className="border-b border-slate-100 px-3 py-1.5">
            <p className="truncate text-xs font-semibold text-slate-700">{ctx.candidate.full_name}</p>
            <p className="truncate text-xs text-slate-400">{ctx.candidate.position}</p>
          </div>
          <div className="max-h-60 overflow-y-auto px-1 py-1">
            {STAGES.map((s) => (
              <button
                key={s.value}
                onClick={() => move(ctx.candidate.id, s.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-slate-50 ${ctx.candidate.stage === s.value ? 'font-semibold text-brand-700' : 'text-slate-700'}`}
              >
                <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${s.color.split(' ')[0]}`} />
                {s.label}
                {ctx.candidate.stage === s.value && <span className="ml-auto text-brand-500">✓</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 px-1 py-1">
            <Link
              to={`/candidates/${ctx.candidate.id}`}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setCtx(null)}
            >
              Открыть карточку →
            </Link>
            <button
              onClick={() => remove(ctx.candidate.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── KANBAN ── */
function KanbanView({ candidates, dragId, setDragId, move, openCtx }: {
  candidates: Candidate[]
  dragId: number | null
  setDragId: (id: number | null) => void
  move: (id: number, stage: Stage) => void
  openCtx: (e: React.MouseEvent, c: Candidate) => void
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STAGES.map((s) => {
        const items = candidates.filter((c) => c.stage === s.value)
        return (
          <div
            key={s.value}
            className="w-60 flex-shrink-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId) move(dragId, s.value); setDragId(null) }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-medium text-slate-700">{s.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>{items.length}</span>
            </div>
            <div className="min-h-[100px] space-y-2 rounded-xl bg-slate-100/70 p-2">
              {items.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onContextMenu={(e) => openCtx(e, c)}
                  className="card cursor-grab select-none p-3 active:cursor-grabbing"
                >
                  <Link to={`/candidates/${c.id}`} className="line-clamp-1 text-sm font-medium hover:text-brand-600">
                    {c.full_name}
                  </Link>
                  <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">{c.position}</div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{c.city}</span>
                    {c.latest_analysis && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-semibold text-emerald-700">
                        {c.latest_analysis.score}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="py-4 text-center text-xs text-slate-400">Пусто</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── TABLE ── */
function TableView({ candidates, move, openCtx }: {
  candidates: Candidate[]
  move: (id: number, stage: Stage) => void
  openCtx: (e: React.MouseEvent, c: Candidate) => void
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">ФИО</th>
              <th className="px-4 py-3 font-medium">Должность</th>
              <th className="px-4 py-3 font-medium">Город</th>
              <th className="px-4 py-3 font-medium">Этап</th>
              <th className="px-4 py-3 font-medium">Рекрутер</th>
              <th className="px-4 py-3 font-medium">ИИ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50" onContextMenu={(e) => openCtx(e, c)}>
                <td className="px-4 py-3">
                  <Link to={`/candidates/${c.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                    {c.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{c.position}</td>
                <td className="px-4 py-3 text-slate-500">{c.city ?? '—'}</td>
                <td className="px-4 py-3">
                  <select
                    value={c.stage}
                    onChange={(e) => move(c.id, e.target.value as Stage)}
                    className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${stageColor(c.stage)}`}
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{c.recruiter?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  {c.latest_analysis ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                      {c.latest_analysis.score}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Кандидаты не найдены</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
