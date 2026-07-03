import { useEffect, useState } from 'react'
import { Plus, FileDown, ChevronDown, ChevronRight, Users } from 'lucide-react'
import api from '../api'
import { HiringRequest, Department, Candidate, stageLabel } from '../types'
import { Modal, PageHeader, Empty } from '../components/ui'
import { useAuth } from '../auth'

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  in_progress: 'bg-brand-100 text-brand-700',
  closed: 'bg-slate-100 text-slate-500',
}
const statusLabel: Record<string, string> = {
  pending: 'На рассмотрении', approved: 'Одобрена', rejected: 'Отклонена',
  in_progress: 'В работе', closed: 'Закрыта',
}
const priorityBadge: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500', normal: 'bg-sky-100 text-sky-700',
  high: 'bg-amber-100 text-amber-700', urgent: 'bg-rose-100 text-rose-700',
}
const priorityLabel: Record<string, string> = { low: 'Низкий', normal: 'Обычный', high: 'Высокий', urgent: 'Срочно' }

export default function HiringRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<HiringRequest[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [recruiters, setRecruiters] = useState<{ id: number; name: string }[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [attachFor, setAttachFor] = useState<HiringRequest | null>(null)
  const [form, setForm] = useState({ title: '', position: '', city: 'Алматы', headcount: 1, department_id: '', salary_range: '', priority: 'normal', requirements: '', description: '' })

  const canManage = user?.role === 'admin' || user?.role === 'recruiter'
  const isAdmin = user?.role === 'admin'

  const load = () => api.get('/hiring-requests', { params: { per_page: 100 } }).then((r) => setRequests(r.data.data ?? r.data))
  useEffect(() => {
    load()
    api.get('/departments').then((r) => setDepartments(r.data))
    if (canManage) api.get('/recruiters').then((r) => setRecruiters(r.data))
    api.get('/candidates', { params: { per_page: 300 } }).then((r) => setCandidates(r.data.data ?? []))
  }, [])

  const create = async () => {
    await api.post('/hiring-requests', { ...form, department_id: form.department_id || null })
    setShowAdd(false)
    setForm({ title: '', position: '', city: 'Алматы', headcount: 1, department_id: '', salary_range: '', priority: 'normal', requirements: '', description: '' })
    load()
  }

  const update = async (r: HiringRequest, data: any) => {
    await api.put(`/hiring-requests/${r.id}`, data)
    load()
  }

  const downloadPdf = (r: HiringRequest) => {
    const esc = (s?: string | null) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Заявка — ${esc(r.title)}</title>
<style>@page{margin:15mm 20mm}body{font-family:Arial,sans-serif;font-size:10pt;color:#111827}
h1{font-size:16pt;border-bottom:2px solid #2563eb;padding-bottom:8px;margin-bottom:12px}
.row{display:flex;gap:20px;margin-bottom:6px;font-size:10pt}
.lbl{font-weight:bold;min-width:130px;color:#374151}
.sect{margin-top:12px}.sect-title{font-size:9pt;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.sect-body{white-space:pre-wrap;font-size:9.5pt;color:#1f2937}
</style></head><body>
<h1>${esc(r.title)}</h1>
<div class="row"><span class="lbl">Должность:</span><span>${esc(r.position)}</span></div>
<div class="row"><span class="lbl">Кол-во:</span><span>${r.headcount}</span></div>
<div class="row"><span class="lbl">Город:</span><span>${esc(r.city)}</span></div>
${r.department ? `<div class="row"><span class="lbl">Подразделение:</span><span>${esc(r.department.name)}</span></div>` : ''}
${r.salary_range ? `<div class="row"><span class="lbl">Зарплата:</span><span>${esc(r.salary_range)}</span></div>` : ''}
<div class="row"><span class="lbl">Приоритет:</span><span>${priorityLabel[r.priority] ?? r.priority}</span></div>
<div class="row"><span class="lbl">Статус:</span><span>${statusLabel[r.status] ?? r.status}</span></div>
<div class="row"><span class="lbl">Заказчик:</span><span>${esc(r.requester?.name)}</span></div>
${r.recruiter ? `<div class="row"><span class="lbl">Рекрутер:</span><span>${esc(r.recruiter.name)}</span></div>` : ''}
${r.requirements ? `<div class="sect"><div class="sect-title">Требования</div><div class="sect-body">${esc(r.requirements)}</div></div>` : ''}
${r.description ? `<div class="sect"><div class="sect-title">Описание</div><div class="sect-body">${esc(r.description)}</div></div>` : ''}
</body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 300)
  }

  // Group by recruiter for admin
  const grouped: { key: string; recruiter: string; items: HiringRequest[] }[] = isAdmin
    ? Object.values(
        requests.reduce<Record<string, { key: string; recruiter: string; items: HiringRequest[] }>>((acc, r) => {
          const key = r.recruiter ? String(r.recruiter.id) : 'none'
          const name = r.recruiter?.name ?? 'Без рекрутера'
          if (!acc[key]) acc[key] = { key, recruiter: name, items: [] }
          acc[key].items.push(r)
          return acc
        }, {})
      )
    : [{ key: 'all', recruiter: '', items: requests }]

  return (
    <div>
      <PageHeader
        title="Заявки на подбор"
        subtitle="Руководители подают заявку на нового работника — рекрутеры берут в работу"
        action={<button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Подать заявку</button>}
      />

      {requests.length === 0 ? (
        <Empty text="Нет заявок" />
      ) : isAdmin ? (
        <div className="space-y-6">
          {grouped.map((g) => (
            <RecruiterSection key={g.key} recruiter={g.recruiter} requests={g.items}
              canManage={canManage} recruiters={recruiters} candidates={candidates}
              onUpdate={update} onDownload={downloadPdf} onAttach={setAttachFor} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard key={r.id} r={r} canManage={canManage} recruiters={recruiters}
              candidates={candidates} onUpdate={update} onDownload={downloadPdf} onAttach={setAttachFor} />
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Заявка на нового работника">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Название заявки *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Нужен Web-разработчик" /></div>
          <div><label className="label">Должность *</label><input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
          <div><label className="label">Кол-во</label><input type="number" min={1} className="input" value={form.headcount} onChange={(e) => setForm({ ...form, headcount: +e.target.value })} /></div>
          <div><label className="label">Город</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><label className="label">Подразделение</label><select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className="label">Зарплата</label><input className="input" value={form.salary_range} onChange={(e) => setForm({ ...form, salary_range: e.target.value })} /></div>
          <div><label className="label">Приоритет</label><select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{Object.entries(priorityLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="sm:col-span-2"><label className="label">Требования</label><textarea className="input h-20" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setShowAdd(false)}>Отмена</button>
          <button className="btn-primary" disabled={!form.title || !form.position} onClick={create}>Отправить заявку</button>
        </div>
      </Modal>

      {attachFor && (
        <AssignCandidateModal request={attachFor} candidates={candidates} onClose={() => setAttachFor(null)} />
      )}
    </div>
  )
}

function RecruiterSection({ recruiter, requests, canManage, recruiters, candidates, onUpdate, onDownload, onAttach }: {
  recruiter: string; requests: HiringRequest[]
  canManage: boolean; recruiters: any[]; candidates: Candidate[]
  onUpdate: (r: HiringRequest, data: any) => void
  onDownload: (r: HiringRequest) => void
  onAttach: (r: HiringRequest) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const open = requests.filter((r) => r.status === 'pending' || r.status === 'in_progress').length
  return (
    <div>
      <button className="flex w-full items-center gap-2 mb-3 text-left" onClick={() => setCollapsed((x) => !x)}>
        {collapsed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        <span className="font-semibold text-slate-800">{recruiter}</span>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">{open} активных</span>
        <span className="text-xs text-slate-400">/ {requests.length} всего</span>
      </button>
      {!collapsed && (
        <div className="space-y-3 pl-5 border-l-2 border-slate-100">
          {requests.map((r) => (
            <RequestCard key={r.id} r={r} canManage={canManage} recruiters={recruiters}
              candidates={candidates} onUpdate={onUpdate} onDownload={onDownload} onAttach={onAttach} />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestCard({ r, canManage, recruiters, candidates, onUpdate, onDownload, onAttach }: {
  r: HiringRequest; canManage: boolean; recruiters: any[]; candidates: Candidate[]
  onUpdate: (r: HiringRequest, data: any) => void
  onDownload: (r: HiringRequest) => void
  onAttach: (r: HiringRequest) => void
}) {
  const attached = candidates.filter((c) => c.vacancy_id && String(c.vacancy_id) === String((r as any).vacancy_id))
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{r.title}</h3>
            <span className={`badge ${priorityBadge[r.priority]}`}>{priorityLabel[r.priority]}</span>
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {r.position} · {r.city} · {r.headcount} чел.{r.department ? ` · ${r.department.name}` : ''}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Заказчик: {r.requester?.name ?? '—'}{r.recruiter ? ` · Рекрутер: ${r.recruiter.name}` : ''}
            {r.salary_range ? ` · ${r.salary_range}` : ''}
          </div>
          {r.requirements && <p className="mt-2 text-sm text-slate-600 line-clamp-2">{r.requirements}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`badge ${statusBadge[r.status]}`}>{statusLabel[r.status]}</span>
          <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand-600" title="Скачать PDF" onClick={() => onDownload(r)}>
            <FileDown size={16} />
          </button>
        </div>
      </div>

      {canManage && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <select className="input w-auto" value={r.status} onChange={(e) => onUpdate(r, { status: e.target.value })}>
            {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input w-auto" value={r.recruiter?.id ?? ''} onChange={(e) => onUpdate(r, { assigned_recruiter_id: e.target.value || null })}>
            <option value="">Назначить рекрутера…</option>
            {recruiters.map((rec) => <option key={rec.id} value={rec.id}>{rec.name}</option>)}
          </select>
          <button className="btn-outline flex items-center gap-1.5 text-sm" onClick={() => onAttach(r)}>
            <Users size={14} /> Прикрепить кандидата
          </button>
          <span className="text-xs text-slate-400 ml-auto">При одобрении → создаётся вакансия</span>
        </div>
      )}

      {attached.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Прикреплённые кандидаты ({attached.length})</p>
          <div className="flex flex-wrap gap-2">
            {attached.map((c) => (
              <a key={c.id} href={`/candidates/${c.id}`} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-brand-50 hover:text-brand-700">
                {c.full_name}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-slate-200`}>{stageLabel(c.stage)}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AssignCandidateModal({ request, candidates, onClose }: {
  request: HiringRequest; candidates: Candidate[]; onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const unattached = candidates.filter((c) =>
    !c.vacancy_id &&
    (c.full_name.toLowerCase().includes(search.toLowerCase()) || c.position.toLowerCase().includes(search.toLowerCase()))
  )

  const assign = async (cId: number) => {
    setSaving(true)
    try {
      await api.put(`/candidates/${cId}`, { vacancy_id: (request as any).vacancy_id || null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Прикрепить кандидата · ${request.title}`} width="max-w-lg">
      <input className="input mb-3" placeholder="Поиск по имени или должности…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {unattached.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Нет свободных кандидатов</p>}
        {unattached.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
            <div>
              <p className="text-sm font-medium">{c.full_name}</p>
              <p className="text-xs text-slate-400">{c.position}{c.city ? ` · ${c.city}` : ''}</p>
            </div>
            <button className="btn-primary text-xs py-1 px-3" disabled={saving} onClick={() => assign(c.id)}>
              Прикрепить
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn-outline" onClick={onClose}>Закрыть</button>
      </div>
    </Modal>
  )
}
