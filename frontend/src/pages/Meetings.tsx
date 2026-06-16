import { useEffect, useState } from 'react'
import { Plus, MapPin, Clock, Trash2, List, Calendar, Pencil, Check, ExternalLink } from 'lucide-react'
import api from '../api'
import { Candidate, Meeting } from '../types'
import { Modal, PageHeader, Empty } from '../components/ui'

function timeUntil(iso: string): string | null {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < -3600000) return null
  if (diff < 0) return 'идёт сейчас'
  const min = Math.round(diff / 60000)
  if (min < 60) return `через ${min} мин`
  const h = Math.floor(min / 60)
  if (h < 24) return `через ${h} ч ${min % 60} мин`
  return `через ${Math.round(h / 24)} дн`
}

function CalendarView({ meetings, onDelete, onToggleDone }: {
  meetings: Meeting[]
  onDelete: (id: number) => void
  onToggleDone: (m: Meeting) => void
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const totalCells = startDow + lastDay.getDate()
  const weeks = Math.ceil(totalCells / 7)

  const byDay: Record<number, Meeting[]> = {}
  meetings.forEach((m) => {
    const d = new Date(m.starts_at)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(m)
    }
  })

  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <button className="btn-ghost px-3 py-1" onClick={prev}>‹</button>
        <span className="font-semibold">{monthNames[month]} {year}</span>
        <button className="btn-ghost px-3 py-1" onClick={next}>›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-400 border-b border-slate-100">
        {dayNames.map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: weeks * 7 }).map((_, i) => {
          const dayNum = i - startDow + 1
          if (dayNum < 1 || dayNum > lastDay.getDate()) {
            return <div key={i} className="min-h-[80px] border-r border-b border-slate-100 bg-slate-50/50" />
          }
          const isToday = today.getDate() === dayNum && today.getMonth() === month && today.getFullYear() === year
          const dayMeetings = byDay[dayNum] ?? []
          return (
            <div key={i} className={`min-h-[80px] border-r border-b border-slate-100 p-1 ${isToday ? 'bg-brand-50' : ''}`}>
              <div className={`mb-1 pr-1 text-right text-xs font-medium ${isToday ? 'text-brand-600' : 'text-slate-500'}`}>{dayNum}</div>
              {dayMeetings.map((m) => (
                <div key={m.id} className={`mb-1 flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-[11px] leading-tight group ${m.done ? 'line-through opacity-50 bg-slate-100 text-slate-500' : 'bg-brand-100 text-brand-800'}`}>
                  <span className="truncate">{new Date(m.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} {m.title}</span>
                  <div className="hidden group-hover:flex gap-0.5 shrink-0">
                    <button className="text-emerald-600" onClick={() => onToggleDone(m)}>✓</button>
                    <button className="text-rose-500" onClick={() => onDelete(m.id)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [candidates, setCandidates] = useState<{ id: number; full_name: string; position: string }[]>([])
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState<Meeting | null>(null)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [showDone, setShowDone] = useState(false)
  const emptyForm = { title: '', starts_at: '', duration_min: 30, location: '', notes: '', candidate_id: '' }
  const [form, setForm] = useState(emptyForm)

  const load = () => api.get('/meetings').then((r) => setMeetings(r.data))
  useEffect(() => {
    load()
    api.get('/candidates', { params: { per_page: 200 } }).then((r) => setCandidates(r.data.data ?? []))
  }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShow(true) }
  const openEdit = (m: Meeting) => {
    setEditing(m)
    setForm({
      title: m.title,
      starts_at: m.starts_at.slice(0, 16),
      duration_min: m.duration_min,
      location: m.location ?? '',
      notes: m.notes ?? '',
      candidate_id: m.candidate_id ? String(m.candidate_id) : '',
    })
    setShow(true)
  }

  const save = async () => {
    const payload = { ...form, candidate_id: form.candidate_id ? parseInt(form.candidate_id) : null }
    if (editing) {
      await api.put(`/meetings/${editing.id}`, payload)
    } else {
      await api.post('/meetings', payload)
    }
    setShow(false)
    setForm(emptyForm)
    setEditing(null)
    load()
  }

  const remove = async (id: number) => {
    if (!confirm('Удалить встречу?')) return
    await api.delete(`/meetings/${id}`)
    load()
  }

  const toggleDone = async (m: Meeting) => {
    await api.put(`/meetings/${m.id}`, { done: m.done ? 0 : 1 })
    load()
  }

  const active = meetings.filter((m) => !m.done)
  const done = meetings.filter((m) => m.done)
  const visible = showDone ? meetings : active

  return (
    <div>
      <PageHeader
        title="Встречи"
        subtitle={`${active.length} активных · ${done.length} завершённых`}
        action={
          <div className="flex gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              <button className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${view === 'list' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setView('list')}><List size={15} /> Список</button>
              <button className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${view === 'calendar' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setView('calendar')}><Calendar size={15} /> Календарь</button>
            </div>
            <button className="btn-primary" onClick={openAdd}><Plus size={16} /> Встреча</button>
          </div>
        }
      />

      {(() => {
        const now = Date.now()
        const next = active.filter((m) => new Date(m.starts_at).getTime() > now - 3600000).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0]
        if (!next) return null
        const diff = new Date(next.starts_at).getTime() - now
        const isUrgent = diff > 0 && diff < 2 * 3600000
        const isToday = new Date(next.starts_at).toDateString() === new Date().toDateString()
        if (!isUrgent && !isToday) return null
        return (
          <div className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${isUrgent ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
            <Clock size={18} className={isUrgent ? 'text-rose-500' : 'text-amber-500'} />
            <div className="flex-1">
              <div className={`font-medium ${isUrgent ? 'text-rose-800' : 'text-amber-800'}`}>{next.title}</div>
              <div className={`text-sm ${isUrgent ? 'text-rose-600' : 'text-amber-600'}`}>
                {new Date(next.starts_at).toLocaleString('ru-RU', { timeStyle: 'short', dateStyle: 'medium' })}
                {diff > 0 ? ` — ${timeUntil(next.starts_at)}` : ' — идёт сейчас'}
              </div>
            </div>
            {next.location && (
              <a href={next.location.startsWith('http') ? next.location : undefined} target="_blank" rel="noreferrer"
                className="btn-outline text-xs flex items-center gap-1">
                <ExternalLink size={12} /> {next.location.startsWith('http') ? 'Открыть ссылку' : next.location}
              </a>
            )}
          </div>
        )
      })()}

      {meetings.length === 0 ? (
        <Empty text="Нет запланированных встреч" />
      ) : view === 'calendar' ? (
        <CalendarView meetings={visible} onDelete={remove} onToggleDone={toggleDone} />
      ) : (
        <>
          <div className="space-y-2">
            {visible.map((m) => {
              const left = timeUntil(m.starts_at)
              return (
                <div key={m.id} className={`card flex items-center justify-between gap-3 p-4 ${m.done ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => toggleDone(m)}
                      className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded border-2 transition-colors flex items-center justify-center ${m.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}
                    >
                      {m.done && <Check size={12} />}
                    </button>
                    <div className="min-w-0">
                      <div className={`flex flex-wrap items-center gap-2 ${m.done ? 'line-through text-slate-400' : ''}`}>
                        <span className="font-medium">{m.title}</span>
                        {left && !m.done && <span className="badge bg-brand-50 text-brand-700 text-xs"><Clock size={11} className="mr-1" />{left}</span>}
                      </div>
                      <div className="mt-0.5 text-sm text-slate-500">
                        {new Date(m.starts_at).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })} · {m.duration_min} мин
                        {m.location && (
                          m.location.startsWith('http')
                            ? <a href={m.location} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-brand-600 hover:underline"><ExternalLink size={11} /> ссылка</a>
                            : <span className="ml-1 inline-flex items-center gap-1"><MapPin size={11} /> {m.location}</span>
                        )}
                      </div>
                      {m.candidate && <div className="mt-0.5 text-xs text-slate-400">Кандидат: {m.candidate.full_name}</div>}
                      {m.notes && <div className="mt-1 text-xs text-slate-400 italic">{m.notes}</div>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button className="btn-ghost p-2 text-slate-400 hover:text-brand-600" onClick={() => openEdit(m)} title="Редактировать"><Pencil size={15} /></button>
                    <button className="btn-ghost p-2 text-slate-400 hover:text-rose-600" onClick={() => remove(m.id)} title="Удалить"><Trash2 size={15} /></button>
                  </div>
                </div>
              )
            })}
          </div>

          {done.length > 0 && (
            <button
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2.5 text-sm text-slate-400 hover:bg-slate-50"
              onClick={() => setShowDone((x) => !x)}
            >
              {showDone ? `Скрыть завершённые (${done.length})` : `Показать завершённые (${done.length})`}
            </button>
          )}
        </>
      )}

      <Modal open={show} onClose={() => { setShow(false); setEditing(null) }} title={editing ? 'Редактировать встречу' : 'Новая встреча'}>
        <div className="grid gap-3">
          <div><label className="label">Название *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Техинтервью с кандидатом" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Дата и время *</label><input type="datetime-local" className="input" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div><label className="label">Длительность (мин)</label><input type="number" min={5} className="input" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: +e.target.value })} /></div>
          </div>
          <div><label className="label">Место / ссылка</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Zoom / Офис, ул. Казыбаева 20" /></div>
          <div>
            <label className="label">Кандидат (необязательно)</label>
            <select className="input" value={form.candidate_id} onChange={(e) => setForm({ ...form, candidate_id: e.target.value })}>
              <option value="">— без кандидата —</option>
              {candidates.map((c) => <option key={c.id} value={String(c.id)}>{c.full_name} · {c.position}</option>)}
            </select>
          </div>
          <div><label className="label">Заметки</label><textarea className="input h-16" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Дополнительная информация…" /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => { setShow(false); setEditing(null) }}>Отмена</button>
          <button className="btn-primary" disabled={!form.title || !form.starts_at} onClick={save}>{editing ? 'Сохранить' : 'Создать'}</button>
        </div>
      </Modal>
    </div>
  )
}
