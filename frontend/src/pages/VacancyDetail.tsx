import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Upload, Sparkles, MapPin, Users, Building2, Banknote, ChevronDown,
} from 'lucide-react'
import api from '../api'
import { Vacancy, Candidate, STAGES, Stage, stageColor, stageLabel, SOURCES } from '../types'
import { Modal, LoadingState } from '../components/ui'

interface VacancyFull extends Vacancy {
  candidates: Candidate[]
  description?: string
  requirements?: string
  recruiter_id?: number
}

const priorityLabel: Record<string, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий', urgent: 'Срочно' }
const statusLabel: Record<string, string> = { open: 'Открыта', paused: 'Приостановлена', closed: 'Закрыта' }
const statusBadge: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  closed: 'bg-slate-100 text-slate-500',
}

export default function VacancyDetail() {
  const { id } = useParams()
  const [v, setV] = useState<VacancyFull | null>(null)
  const [showAttach, setShowAttach] = useState(false)

  const load = () => api.get<VacancyFull>(`/vacancies/${id}`).then((r) => setV(r.data))
  useEffect(() => { load() }, [id])

  if (!v) return <LoadingState />

  const updateVacancy = async (field: string, value: string) => {
    await api.put(`/vacancies/${v.id}`, { [field]: value })
    load()
  }

  const updateCandidateStage = async (cId: number, stage: Stage) => {
    setV((prev) => prev ? { ...prev, candidates: prev.candidates.map((c) => c.id === cId ? { ...c, stage } : c) } : prev)
    await api.put(`/candidates/${cId}`, { stage })
  }

  const hired = v.candidates.filter((c) => c.stage === 'hired').length
  const total = v.candidates.length

  return (
    <div>
      <Link to="/vacancies" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} /> К вакансиям
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: vacancy info card */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-lg font-semibold leading-snug">{v.title}</h1>
              <span className={`badge flex-shrink-0 ${statusBadge[v.status]}`}>{statusLabel[v.status]}</span>
            </div>

            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <EditField label="Статус" type="select" value={v.status} options={[
                { value: 'open', label: 'Открыта' },
                { value: 'paused', label: 'Приостановлена' },
                { value: 'closed', label: 'Закрыта' },
              ]} onSave={(val) => updateVacancy('status', val)} />
              <EditField label="Приоритет" type="select" value={v.priority ?? 'medium'} options={[
                { value: 'low', label: 'Низкий' },
                { value: 'medium', label: 'Средний' },
                { value: 'high', label: 'Высокий' },
                { value: 'urgent', label: 'Срочно' },
              ]} onSave={(val) => updateVacancy('priority', val)} />
              <EditField label="Должность" value={v.position ?? ''} onSave={(val) => updateVacancy('position', val)} />
              <EditField label="Город" value={v.city ?? ''} onSave={(val) => updateVacancy('city', val)} />
              <EditField label="Зарплата" value={v.salary_range ?? ''} onSave={(val) => updateVacancy('salary_range', val)} />
            </div>

            {v.department && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <Building2 size={14} className="text-slate-400" />
                {v.department.name}
              </div>
            )}
            {v.city && (
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <MapPin size={14} className="text-slate-400" />
                {v.city}
              </div>
            )}
            {v.salary_range && (
              <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Banknote size={14} className="text-slate-400" />
                {v.salary_range}
              </div>
            )}

            <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
              <div className="flex items-center gap-1"><Users size={14} /> {total} кандидатов</div>
              {hired > 0 && <div className="text-emerald-600 font-medium">{hired} нанято</div>}
            </div>
          </div>

          {/* Recruiter */}
          {v.recruiter && (
            <div className="card p-4 text-sm">
              <p className="text-xs text-slate-400 mb-1">Рекрутер</p>
              <p className="font-medium text-slate-800">{v.recruiter.name}</p>
            </div>
          )}

          {/* Requirements */}
          {v.requirements && (
            <div className="card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Требования</p>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{v.requirements}</p>
            </div>
          )}

          {/* Description */}
          {v.description && (
            <div className="card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Описание</p>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{v.description}</p>
            </div>
          )}
        </div>

        {/* Right: candidates */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Кандидаты ({total})</h2>
            <button className="btn-primary" onClick={() => setShowAttach(true)}>
              <Plus size={15} /> Прикрепить резюме
            </button>
          </div>

          {total === 0 ? (
            <div className="card p-10 text-center text-slate-400 text-sm">
              Кандидатов нет. Нажмите «Прикрепить резюме», чтобы добавить.
            </div>
          ) : (
            <div className="space-y-2">
              {v.candidates.map((c) => (
                <CandidateRow key={c.id} candidate={c} onStageChange={updateCandidateStage} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showAttach && (
        <MultiAttachModal vacancy={v} onClose={() => setShowAttach(false)} onDone={load} />
      )}
    </div>
  )
}

/* ── Editable field ── */
function EditField({ label, value, type = 'text', options, onSave }: {
  label: string
  value: string
  type?: 'text' | 'select'
  options?: { value: string; label: string }[]
  onSave: (val: string) => void
}) {
  if (type === 'select' && options) {
    return (
      <div>
        <label className="label">{label}</label>
        <select className="input" value={value} onChange={(e) => onSave(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    )
  }
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" defaultValue={value} onBlur={(e) => { if (e.target.value !== value) onSave(e.target.value) }} />
    </div>
  )
}

/* ── Candidate row ── */
function CandidateRow({ candidate: c, onStageChange }: {
  candidate: Candidate
  onStageChange: (id: number, stage: Stage) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ phone: c.phone ?? '', email: c.email ?? '', city: c.city ?? '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try { await api.put(`/candidates/${c.id}`, form) } finally { setSaving(false); setEditing(false) }
  }

  return (
    <div className="card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-3">
        <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
          {c.full_name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <Link to={`/candidates/${c.id}`} className="font-medium text-slate-800 hover:text-brand-600">
            {c.full_name}
          </Link>
          <div className="text-xs text-slate-400">{c.position}{c.city ? ` · ${c.city}` : ''}</div>
        </div>
        <select
          value={c.stage}
          onChange={(e) => onStageChange(c.id, e.target.value as Stage)}
          className={`flex-shrink-0 rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${stageColor(c.stage)}`}
        >
          {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {c.latest_analysis && (
          <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
            {c.latest_analysis.score}
          </span>
        )}
        <button className="text-slate-400 hover:text-slate-600" onClick={() => setOpen((x) => !x)}>
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expandable details */}
      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          {editing ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="label">Телефон</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label">Город</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div className="sm:col-span-3 flex gap-2 justify-end">
                <button className="btn-outline" onClick={() => setEditing(false)}>Отмена</button>
                <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
              {c.phone && <span>📞 {c.phone}</span>}
              {c.email && <span>✉️ {c.email}</span>}
              {c.city && <span>📍 {c.city}</span>}
              {c.source && <span className="text-xs text-slate-400">Источник: {c.source}</span>}
              <div className="ml-auto flex gap-2">
                <button className="btn-outline text-xs py-1 px-2" onClick={() => setEditing(true)}>Изменить</button>
                <Link to={`/candidates/${c.id}`} className="btn-outline text-xs py-1 px-2">Открыть →</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Multi-attach modal ── */
interface ResumeEntry {
  id: number
  name: string
  phone: string
  source: string
  text: string
  loading: boolean
}

function MultiAttachModal({ vacancy, onClose, onDone }: { vacancy: Vacancy; onClose: () => void; onDone: () => void }) {
  const [entries, setEntries] = useState<ResumeEntry[]>([{ id: Date.now(), name: '', phone: '', source: 'hh.kz', text: '', loading: false }])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const add = () => setEntries((e) => [...e, { id: Date.now(), name: '', phone: '', source: 'hh.kz', text: '', loading: false }])
  const remove = (id: number) => setEntries((e) => e.filter((x) => x.id !== id))
  const update = (id: number, patch: Partial<ResumeEntry>) =>
    setEntries((e) => e.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      const id = Date.now() + Math.random()
      const entryId = Math.floor(id)
      const name = file.name.replace(/\.[^.]+$/, '')
      setEntries((e) => [...e, { id: entryId, name, phone: '', source: 'hh.kz', text: '', loading: true }])
      try {
        if (file.name.toLowerCase().endsWith('.pdf')) {
          const reader = new FileReader()
          await new Promise<void>((resolve) => {
            reader.onload = async () => {
              try {
                const base64 = (reader.result as string).split(',')[1]
                const res = await api.post<{ text: string }>('/parse-pdf', { pdf_base64: base64 })
                update(entryId, { text: res.data.text.slice(0, 5000), loading: false })
              } catch {
                update(entryId, { loading: false })
              }
              resolve()
            }
            reader.readAsDataURL(file)
          })
        } else {
          const text = await file.text()
          update(entryId, { text: text.slice(0, 5000), loading: false })
        }
      } catch {
        update(entryId, { loading: false })
      }
    }
    // remove initial empty placeholder entry now that files have been added
    setEntries((e) => e.filter((x) => x.name !== '' || x.text !== '' || x.loading))
  }

  const submit = async () => {
    const valid = entries.filter((e) => e.name.trim())
    if (!valid.length) return
    setSubmitting(true)
    try {
      await Promise.all(valid.map((e) =>
        api.post('/candidates', {
          full_name: e.name,
          phone: e.phone || null,
          position: vacancy.position || vacancy.title,
          city: vacancy.city || null,
          source: e.source,
          resume_text: e.text || null,
          vacancy_id: vacancy.id,
        })
      ))
      onClose()
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Прикрепить кандидатов · ${vacancy.title}`} width="max-w-2xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">Добавьте одно или несколько резюме</p>
        <label className="btn-outline text-xs cursor-pointer flex items-center gap-1 py-1.5 px-3">
          <Upload size={13} /> Загрузить файлы (PDF/TXT)
          <input ref={fileInputRef} type="file" accept=".pdf,.txt" multiple className="hidden"
            onChange={(e) => onFiles(e.target.files)} />
        </label>
      </div>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {entries.map((e, i) => (
          <div key={e.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500">Кандидат {i + 1}{e.loading ? ' · Загрузка…' : ''}</span>
              {entries.length > 1 && (
                <button className="text-xs text-rose-500 hover:text-rose-700" onClick={() => remove(e.id)}>Удалить</button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="label">ФИО *</label>
                <input className="input" value={e.name} onChange={(ev) => update(e.id, { name: ev.target.value })} />
              </div>
              <div>
                <label className="label">Телефон</label>
                <input className="input" value={e.phone} onChange={(ev) => update(e.id, { phone: ev.target.value })} />
              </div>
              <div>
                <label className="label">Источник</label>
                <select className="input" value={e.source} onChange={(ev) => update(e.id, { source: ev.target.value })}>
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-2">
              <label className="label">Резюме (текст)</label>
              <textarea className="input h-16 text-xs" value={e.text} onChange={(ev) => update(e.id, { text: ev.target.value })} placeholder="Вставьте текст или загрузите PDF выше" />
            </div>
          </div>
        ))}
      </div>

      <button className="mt-3 flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700" onClick={add}>
        <Plus size={14} /> Добавить ещё кандидата
      </button>

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Отмена</button>
        <button className="btn-primary" disabled={submitting || !entries.some((e) => e.name.trim())} onClick={submit}>
          <Sparkles size={15} /> {submitting ? 'Сохранение…' : `Прикрепить (${entries.filter((e) => e.name.trim()).length})`}
        </button>
      </div>
    </Modal>
  )
}
