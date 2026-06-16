import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MapPin, Users, ChevronDown, ChevronRight } from 'lucide-react'
import api from '../api'
import { Vacancy, Department } from '../types'
import { Modal, PageHeader, Empty } from '../components/ui'
import { useAuth } from '../auth'

const statusBadge: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  closed: 'bg-slate-100 text-slate-500',
}
const statusLabel: Record<string, string> = { open: 'Открыта', paused: 'Приостановлена', closed: 'Закрыта' }
const priorityBadge: Record<string, string> = { low: 'bg-slate-100 text-slate-500', medium: '', high: 'bg-orange-100 text-orange-700', urgent: 'bg-rose-100 text-rose-700' }
const priorityLabel: Record<string, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий', urgent: 'Срочно' }

export default function Vacancies() {
  const { user } = useAuth()
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', city: 'Алматы', position: '', salary_range: '', department_id: '', requirements: '', priority: 'medium' })

  const load = () => api.get('/vacancies').then((r) => setVacancies(r.data))
  useEffect(() => { load(); api.get('/departments').then((r) => setDepartments(r.data)) }, [])

  const create = async () => {
    await api.post('/vacancies', { ...form, department_id: form.department_id || null })
    setShowAdd(false)
    setForm({ title: '', city: 'Алматы', position: '', salary_range: '', department_id: '', requirements: '', priority: 'medium' })
    load()
  }

  const isAdmin = user?.role === 'admin'

  const grouped: { recruiter: string; recruiterId?: number; items: Vacancy[] }[] = isAdmin
    ? Object.values(
        vacancies.reduce<Record<string, { recruiter: string; recruiterId?: number; items: Vacancy[] }>>((acc, v) => {
          const key = v.recruiter ? String(v.recruiter.id) : 'none'
          const name = v.recruiter?.name ?? 'Без рекрутера'
          if (!acc[key]) acc[key] = { recruiter: name, recruiterId: v.recruiter?.id, items: [] }
          acc[key].items.push(v)
          return acc
        }, {})
      )
    : [{ recruiter: user?.name ?? '', items: vacancies }]

  return (
    <div>
      <PageHeader
        title="Вакансии"
        subtitle={`Открытых: ${vacancies.filter((v) => v.status === 'open').length}`}
        action={<button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Вакансия</button>}
      />

      {vacancies.length === 0 ? (
        <Empty text="Нет вакансий" />
      ) : isAdmin ? (
        <div className="space-y-6">
          {grouped.map((g) => (
            <RecruiterSection key={g.recruiter} recruiter={g.recruiter} vacancies={g.items} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vacancies.map((v) => <VacancyCard key={v.id} v={v} />)}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Новая вакансия">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Название *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Должность</label><input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
          <div><label className="label">Город</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><label className="label">Подразделение</label><select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className="label">Зарплата</label><input className="input" value={form.salary_range} onChange={(e) => setForm({ ...form, salary_range: e.target.value })} placeholder="500 000 — 700 000 KZT" /></div>
          <div><label className="label">Приоритет</label>
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
              <option value="urgent">Срочно</option>
            </select>
          </div>
          <div className="sm:col-span-2"><label className="label">Требования</label><textarea className="input h-20" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setShowAdd(false)}>Отмена</button>
          <button className="btn-primary" disabled={!form.title} onClick={create}>Создать</button>
        </div>
      </Modal>
    </div>
  )
}

function RecruiterSection({ recruiter, vacancies }: { recruiter: string; vacancies: Vacancy[] }) {
  const [collapsed, setCollapsed] = useState(false)
  const open = vacancies.filter((v) => v.status === 'open').length
  return (
    <div>
      <button
        className="flex w-full items-center gap-2 mb-3 text-left"
        onClick={() => setCollapsed((x) => !x)}
      >
        {collapsed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        <span className="font-semibold text-slate-800">{recruiter}</span>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">{open} открытых</span>
        <span className="text-xs text-slate-400">/ {vacancies.length} всего</span>
      </button>
      {!collapsed && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vacancies.map((v) => <VacancyCard key={v.id} v={v} />)}
        </div>
      )}
    </div>
  )
}

function VacancyCard({ v }: { v: Vacancy }) {
  return (
    <Link
      to={`/vacancies/${v.id}`}
      className="card block p-5 transition-shadow hover:shadow-md hover:border-brand-200"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug text-slate-800">{v.title}</h3>
        <div className="flex flex-col items-end gap-1">
          <span className={`badge flex-shrink-0 ${statusBadge[v.status]}`}>{statusLabel[v.status]}</span>
          {v.priority && v.priority !== 'medium' && priorityBadge[v.priority] && (
            <span className={`badge text-[10px] ${priorityBadge[v.priority]}`}>
              {priorityLabel[v.priority]}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 space-y-1 text-sm text-slate-500">
        {v.department && <div className="text-xs">{v.department.name}</div>}
        {v.city && <div className="flex items-center gap-1"><MapPin size={13} /> {v.city}</div>}
        {v.salary_range && <div className="font-medium text-slate-700">{v.salary_range}</div>}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
        <div className="flex items-center gap-1"><Users size={13} /> {v.candidates_count ?? 0} кандидатов</div>
        {v.recruiter && <span className="text-xs">{v.recruiter.name}</span>}
      </div>
    </Link>
  )
}
