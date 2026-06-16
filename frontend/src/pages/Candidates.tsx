import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Upload, Sparkles, Search, Download } from 'lucide-react'
import api from '../api'
import { Candidate, STAGES, SOURCES, stageColor, stageLabel } from '../types'
import { Modal, PageHeader } from '../components/ui'
import { useAuth } from '../auth'
import { usePdfUpload } from '../hooks/usePdfUpload'

interface Paginated {
  data: Candidate[]
  meta: {
    current_page: number
    last_page: number
    total: number
    per_page: number
  }
}

const emptyForm = {
  full_name: '', phone: '', email: '', city: '', department: '',
  position: '', source: 'hh.kz', stage: 'new', resume_text: '', resume_url: '',
  age: '', telegram: '', recruiter_id: '',
}

export default function Candidates() {
  const { user } = useAuth()
  const [page, setPage] = useState<Paginated | null>(null)
  const [filters, setFilters] = useState({ search: '', stage: '', source: '', city: '', organization: '', recruiter_id: '' })
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [recruiters, setRecruiters] = useState<{ id: number; name: string }[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const { pdfLoading, handlePdfUpload } = usePdfUpload((text) => setForm((f) => ({ ...f, resume_text: text })))

  const load = () => {
    const params: any = { page: pageNum, per_page: 20 }
    Object.entries(filters).forEach(([k, v]) => v && (params[k] = v))
    api.get<Paginated>('/candidates', { params }).then((r) => { setPage(r.data); setSelectedIds([]) })
  }

  useEffect(load, [pageNum, filters])
  useEffect(() => {
    if (user?.role === 'admin') api.get('/recruiters').then((r) => setRecruiters(r.data))
  }, [user])

  const updateStage = async (c: Candidate, stage: string) => {
    await api.put(`/candidates/${c.id}`, { stage })
    load()
  }

  const createCandidate = async () => {
    setLoading(true)
    try {
      await api.post('/candidates', form)
      setShowAdd(false)
      setForm(emptyForm)
      load()
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = () => {
    if (!page) return
    const headers = ['ФИО', 'Контакт', 'Город', 'Должность', 'Источник', 'Этап', 'Статус']
    const rows = page.data.map((c) => [c.full_name, c.phone, c.city, c.position, c.source, stageLabel(c.stage), c.status])
    const csv = [headers, ...rows].map((r) => r.map((x) => `"${x ?? ''}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'candidates.csv'
    a.click()
  }

  const analyzeBatch = async (limit: number) => {
    if (!confirm(`Запустить ИИ-анализ первых ${limit} непроанализированных кандидатов? Это потратит токены.`)) return
    setBatchLoading(true)
    try {
      const r = await api.post('/candidates/analyze-batch', { limit })
      alert(r.data.message)
      load()
    } finally {
      setBatchLoading(false)
    }
  }

  const analyzeSelected = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Запустить ИИ-анализ ${selectedIds.length} выбранных кандидатов?`)) return
    setAnalyzing(true)
    try {
      const r = await api.post('/candidates/analyze-selected', { ids: selectedIds })
      alert(r.data.message)
      load()
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const toggleAll = () => {
    const ids = page?.data.map((c) => c.id) ?? []
    setSelectedIds((prev) => ids.every((id) => prev.includes(id)) ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])])
  }

  return (
    <div>
      <PageHeader
        title="Кандидаты"
        subtitle={page ? `Всего: ${page.meta.total}` : ''}
        action={
          <div className="flex flex-wrap gap-2">
            {selectedIds.length > 0 && (
              <button className="btn-primary" disabled={analyzing} onClick={analyzeSelected}>
                <Sparkles size={16} /> {analyzing ? 'Анализ...' : `ИИ-анализ (${selectedIds.length})`}
              </button>
            )}
            <button className="btn-outline" onClick={exportCsv}><Download size={16} /> CSV</button>
            <button className="btn-outline" onClick={() => setShowImport(true)}><Upload size={16} /> Импорт</button>
            <div className="relative group">
              <button className="btn-outline" disabled={batchLoading}>
                <Sparkles size={16} /> {batchLoading ? 'Анализ...' : 'ИИ-анализ всех'}
              </button>
              {!batchLoading && (
                <div className="absolute right-0 z-10 mt-1 hidden w-48 card p-1 group-hover:block">
                  {[50, 100, 200].map((n) => (
                    <button key={n} className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => analyzeBatch(n)}>
                      Первые {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Кандидат</button>
          </div>
        }
      />

      <div className="card mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Поиск по ФИО, телефону, должности…"
              value={filters.search}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPageNum(1) }}
            />
          </div>
          <select className="input w-auto" value={filters.stage} onChange={(e) => { setFilters({ ...filters, stage: e.target.value }); setPageNum(1) }}>
            <option value="">Все этапы</option>
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="input w-auto" value={filters.source} onChange={(e) => { setFilters({ ...filters, source: e.target.value }); setPageNum(1) }}>
            <option value="">Все источники</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="input w-32" placeholder="Город" value={filters.city} onChange={(e) => { setFilters({ ...filters, city: e.target.value }); setPageNum(1) }} />
          <input className="input w-36" placeholder="Организация" value={filters.organization} onChange={(e) => { setFilters({ ...filters, organization: e.target.value }); setPageNum(1) }} />
          {user?.role === 'admin' && (
            <select className="input w-auto" value={filters.recruiter_id} onChange={(e) => { setFilters({ ...filters, recruiter_id: e.target.value }); setPageNum(1) }}>
              <option value="">Все рекрутеры</option>
              {recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={(page?.data.length ?? 0) > 0 && (page?.data ?? []).every((c) => selectedIds.includes(c.id))}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 font-medium">ФИО</th>
                <th className="px-4 py-3 font-medium">Контакт</th>
                <th className="px-4 py-3 font-medium">Город</th>
                <th className="px-4 py-3 font-medium">Должность</th>
                <th className="px-4 py-3 font-medium">Источник</th>
                <th className="px-4 py-3 font-medium">Этап (воронка)</th>
                {user?.role === 'admin' && <th className="px-4 py-3 font-medium">Рекрутер</th>}
                <th className="px-4 py-3 font-medium">ИИ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {page?.data.map((c) => (
                <tr key={c.id} className={`hover:bg-slate-50 ${selectedIds.includes(c.id) ? 'bg-brand-50' : ''}`}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleSelect(c.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/candidates/${c.id}`} className="font-medium text-slate-800 hover:text-brand-600">{c.full_name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.phone}</td>
                  <td className="px-4 py-3 text-slate-500">{c.city}</td>
                  <td className="px-4 py-3 text-slate-500">{c.position}</td>
                  <td className="px-4 py-3 text-slate-500">{c.source}</td>
                  <td className="px-4 py-3">
                    <select
                      value={c.stage}
                      onChange={(e) => updateStage(c, e.target.value)}
                      className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${stageColor(c.stage)}`}
                    >
                      {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  {user?.role === 'admin' && <td className="px-4 py-3 text-slate-500">{c.recruiter?.name ?? '—'}</td>}
                  <td className="px-4 py-3">
                    {c.latest_analysis
                      ? <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">{c.latest_analysis.score}</span>
                      : <span className="text-xs text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
              {page?.data.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Кандидаты не найдены</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {page && page.meta.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-400">Стр. {page.meta.current_page} из {page.meta.last_page}</span>
            <div className="flex gap-2">
              <button className="btn-outline" disabled={pageNum <= 1} onClick={() => setPageNum((p) => p - 1)}>Назад</button>
              <button className="btn-outline" disabled={pageNum >= page.meta.last_page} onClick={() => setPageNum((p) => p + 1)}>Вперёд</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Новый кандидат">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">ФИО *</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><label className="label">Контактный номер *</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Город</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><label className="label">Подразделение</label><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          <div><label className="label">Должность *</label><input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
          <div><label className="label">Источник</label><select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
          {user?.role === 'admin' && recruiters.length > 0 && (
            <div><label className="label">Рекрутер</label><select className="input" value={form.recruiter_id} onChange={(e) => setForm({ ...form, recruiter_id: e.target.value })}>
              <option value="">— выбрать —</option>
              {recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select></div>
          )}
          <div><label className="label">Возраст</label><input type="number" min={16} max={80} className="input" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
          <div><label className="label">Telegram</label><input className="input" placeholder="@username" value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} /></div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Текст резюме (для ИИ-анализа)</label>
              <label className="btn-outline text-xs cursor-pointer flex items-center gap-1 py-1 px-2">
                {pdfLoading ? 'Загрузка...' : <><Upload className="w-3 h-3" /> Загрузить PDF</>}
                <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={pdfLoading} />
              </label>
            </div>
            <textarea className="input h-24" value={form.resume_text} onChange={(e) => setForm({ ...form, resume_text: e.target.value })} placeholder="Вставьте текст резюме или загрузите PDF выше" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setShowAdd(false)}>Отмена</button>
          <button className="btn-primary" disabled={loading || !form.full_name || !form.position} onClick={createCandidate}>Создать</button>
        </div>
      </Modal>

      <ImportModal open={showImport} onClose={() => setShowImport(false)} onDone={load} />
    </div>
  )
}

function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('')
  const [position, setPosition] = useState('')
  const [source, setSource] = useState('hh.kz')
  const [loading, setLoading] = useState(false)

  const parsed = useMemo(() => {
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      // Format: ФИО; телефон; город   OR a URL
      if (/^https?:\/\//.test(line)) {
        return { full_name: 'Кандидат по ссылке', position: position || 'Не указана', source, resume_url: line }
      }
      const [full_name, phone, city] = line.split(/[;,\t]/).map((s) => s?.trim())
      return { full_name, phone, city, position: position || 'Не указана', source }
    })
  }, [text, position, source])

  const submit = async () => {
    setLoading(true)
    try {
      const r = await api.post('/candidates/bulk-import', { items: parsed })
      alert(r.data.message)
      setText('')
      onClose()
      onDone()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Массовый импорт кандидатов" width="max-w-xl">
      <p className="mb-3 text-sm text-slate-500">
        Вставьте резюме построчно. Формат: <code className="rounded bg-slate-100 px-1">ФИО; телефон; город</code> —
        или вставьте ссылки на резюме с hh.kz и других платформ (по одной в строке).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Должность (по умолчанию)</label><input className="input" value={position} onChange={(e) => setPosition(e.target.value)} /></div>
        <div><label className="label">Источник</label><select className="input" value={source} onChange={(e) => setSource(e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>
      <textarea
        className="input mt-3 h-40 font-mono text-xs"
        placeholder={'Алмас Нурланов; +7 700 123 4567; Алматы\nhttps://hh.kz/resume/abc123'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 text-xs text-slate-400">Будет создано: {parsed.length}</div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Отмена</button>
        <button className="btn-primary" disabled={loading || parsed.length === 0} onClick={submit}>Импортировать</button>
      </div>
    </Modal>
  )
}
