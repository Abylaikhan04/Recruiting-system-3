import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Sparkles, Send, FileText, MessageSquare, StickyNote, History, Phone, Mail, MapPin, Upload, Download,
} from 'lucide-react'
import api from '../api'
import { Candidate, AiAnalysis, STAGES, SOURCES, stageColor, stageLabel } from '../types'
import { LoadingState } from '../components/ui'
import { usePdfUpload } from '../hooks/usePdfUpload'

type Tab = 'overview' | 'notes' | 'whatsapp' | 'ai' | 'history'

export default function CandidateDetail() {
  const { id } = useParams()
  const [c, setC] = useState<Candidate | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [analyzing, setAnalyzing] = useState(false)
  const [vacancies, setVacancies] = useState<{ id: number; title: string }[]>([])
  const [analyzeVacancyId, setAnalyzeVacancyId] = useState('')

  const load = () => api.get<Candidate>(`/candidates/${id}`).then((r) => setC(r.data))
  const { pdfLoading, handlePdfUpload } = usePdfUpload(async (text) => {
    if (!c) return
    await api.put(`/candidates/${c.id}`, { resume_text: text })
    await load()
  })
  useEffect(() => { load() }, [id])
  useEffect(() => { api.get<{ id: number; title: string }[]>('/vacancies').then((r) => setVacancies(r.data)) }, [])
  useEffect(() => { if (c?.vacancy_id) setAnalyzeVacancyId(String(c.vacancy_id)) }, [c?.id])

  if (!c) return <LoadingState />

  const updateField = async (field: string, value: string) => {
    await api.put(`/candidates/${c.id}`, { [field]: value })
    load()
  }

  const analyze = async () => {
    setAnalyzing(true)
    try {
      await api.post(`/candidates/${c.id}/analyze`, analyzeVacancyId ? { vacancy_id: parseInt(analyzeVacancyId) } : {})
      await load()
      setTab('ai')
    } catch (err: any) {
      alert('Ошибка ИИ-анализа: ' + (err.response?.data?.message || err.message))
    } finally {
      setAnalyzing(false)
    }
  }

  const downloadResume = () => {
    const html = generateResumeHtml(c)
    const w = window.open('', '_blank')
    if (!w) { alert('Разрешите всплывающие окна для скачивания резюме'); return }
    w.document.write(html)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 300)
  }

  const latest: AiAnalysis | undefined = c.analyses?.[0]

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: 'Обзор', icon: FileText },
    { key: 'notes', label: 'Заметки', icon: StickyNote },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { key: 'ai', label: 'ИИ-аналитика', icon: Sparkles },
    { key: 'history', label: 'История', icon: History },
  ]

  return (
    <div>
      <Link to="/candidates" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} /> К кандидатам
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile card */}
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-xl font-semibold text-brand-700">
                {c.full_name.charAt(0)}
              </div>
              <div>
                <h1 className="text-lg font-semibold">{c.full_name}</h1>
                <div className="text-sm text-slate-500">{c.position}</div>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 text-sm">
              {c.phone && <div className="flex items-center gap-2 text-slate-600"><Phone size={15} className="text-slate-400" /> {c.phone}</div>}
              {c.email && <div className="flex items-center gap-2 text-slate-600"><Mail size={15} className="text-slate-400" /> {c.email}</div>}
              {c.city && <div className="flex items-center gap-2 text-slate-600"><MapPin size={15} className="text-slate-400" /> {c.city}</div>}
            </div>

            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
              <div>
                <label className="label">Этап воронки</label>
                <select className={`w-full rounded-lg px-3 py-2 text-sm font-medium ${stageColor(c.stage)}`} value={c.stage} onChange={(e) => updateField('stage', e.target.value)}>
                  {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Должность</label>
                  <input
                    className="input" list="vac-positions"
                    defaultValue={c.position}
                    onBlur={(e) => {
                      if (e.target.value !== c.position) {
                        updateField('position', e.target.value)
                        const m = vacancies.find((v) => v.title === e.target.value)
                        if (m) updateField('vacancy_id', String(m.id))
                      }
                    }}
                  />
                  <datalist id="vac-positions">{vacancies.map((v) => <option key={v.id} value={v.title} />)}</datalist>
                </div>
                <div><label className="label">Телефон</label><input className="input" defaultValue={c.phone ?? ''} onBlur={(e) => e.target.value !== (c.phone ?? '') && updateField('phone', e.target.value)} /></div>
                <div><label className="label">Город</label><input className="input" defaultValue={c.city ?? ''} onBlur={(e) => e.target.value !== (c.city ?? '') && updateField('city', e.target.value)} /></div>
                <div><label className="label">Email</label><input className="input" type="email" defaultValue={c.email ?? ''} onBlur={(e) => e.target.value !== (c.email ?? '') && updateField('email', e.target.value)} /></div>
                <div><label className="label">Возраст</label><input type="number" min={16} max={80} className="input" defaultValue={c.age ?? ''} onBlur={(e) => updateField('age', e.target.value ? parseInt(e.target.value) : null)} /></div>
                <div className="col-span-2"><label className="label">Telegram</label><input className="input" placeholder="@username" defaultValue={c.telegram ?? ''} onBlur={(e) => e.target.value !== (c.telegram ?? '') && updateField('telegram', e.target.value || null)} /></div>
              </div>
              <div><label className="label">Источник</label><select className="input" value={c.source ?? ''} onChange={(e) => updateField('source', e.target.value)}><option value="">—</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
              {c.stage === 'rejected' && (
                <div><label className="label">Причина отказа</label><input className="input" defaultValue={c.rejection_reason} onBlur={(e) => updateField('rejection_reason', e.target.value)} /></div>
              )}
              <div>
                <label className="label">Вакансия для анализа</label>
                <select className="input" value={analyzeVacancyId} onChange={(e) => setAnalyzeVacancyId(e.target.value)}>
                  <option value="">— без вакансии —</option>
                  {vacancies.map((v) => <option key={v.id} value={String(v.id)}>{v.title}</option>)}
                </select>
              </div>
            </div>

            <button className="btn-primary mt-4 w-full" onClick={analyze} disabled={analyzing}>
              <Sparkles size={16} /> {analyzing ? 'Анализ…' : latest ? 'Заново проанализировать' : 'Анализировать ИИ'}
            </button>
          </div>

          {c.recruiter && (
            <div className="card p-4 text-sm">
              <span className="text-slate-400">Рекрутер: </span>
              <span className="font-medium">{c.recruiter.name}</span>
            </div>
          )}
        </div>

        {/* Right: tabs */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
                    tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <t.icon size={15} /> {t.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === 'overview' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">Резюме</h3>
                    <div className="flex gap-1.5">
                      <button className="btn-outline text-xs flex items-center gap-1 py-1 px-2" onClick={downloadResume}>
                        <Download className="w-3 h-3" /> Скачать
                      </button>
                      <label className="btn-outline text-xs cursor-pointer flex items-center gap-1 py-1 px-2">
                        {pdfLoading ? 'Загрузка...' : <><Upload className="w-3 h-3" /> Загрузить PDF</>}
                        <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={pdfLoading} />
                      </label>
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <ResumeView text={c.resume_text} />
                  </div>
                  {c.resume_url && <a href={c.resume_url} target="_blank" className="mt-3 inline-block text-sm text-brand-600 hover:underline">Открыть оригинал резюме →</a>}
                  <div className="mt-4">
                    <label className="label">Комментарий</label>
                    <textarea className="input h-20" defaultValue={c.comment} onBlur={(e) => e.target.value !== c.comment && updateField('comment', e.target.value)} />
                  </div>
                </div>
              )}

              {tab === 'notes' && <Notes candidateId={c.id} notes={(c.notes ?? []).filter((n) => n.type === 'note')} onAdd={load} type="note" />}
              {tab === 'whatsapp' && <Whatsapp candidateId={c.id} notes={(c.notes ?? []).filter((n) => n.type === 'whatsapp')} onAdd={load} />}
              {tab === 'ai' && <AiPanel analysis={latest} onAnalyze={analyze} analyzing={analyzing} />}
              {tab === 'history' && (
                <div className="space-y-3">
                  {(c.history ?? []).length === 0 && <div className="text-sm text-slate-400">История изменений пуста</div>}
                  {(c.history ?? []).map((h) => (
                    <div key={h.id} className="flex items-start gap-3 text-sm">
                      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-400" />
                      <div>
                        <span className="text-slate-700">Поле «{h.field}»: </span>
                        <span className="text-slate-400">{h.from_value || '—'}</span> → <span className="font-medium">{h.to_value || '—'}</span>
                        <div className="text-xs text-slate-400">
                          {h.user?.name} · {new Date(h.created_at).toLocaleString('ru-RU')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Notes({ candidateId, notes, onAdd, type }: any) {
  const [body, setBody] = useState('')
  const send = async () => {
    if (!body.trim()) return
    await api.post(`/candidates/${candidateId}/notes`, { type, body })
    setBody('')
    onAdd()
  }
  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input className="input" placeholder="Добавить заметку…" value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn-primary" onClick={send}><Send size={15} /></button>
      </div>
      <div className="space-y-3">
        {notes.length === 0 && <div className="text-sm text-slate-400">Заметок пока нет</div>}
        {notes.map((n: any) => (
          <div key={n.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <p className="text-slate-700">{n.body}</p>
            <div className="mt-1 text-xs text-slate-400">{n.user?.name} · {new Date(n.created_at).toLocaleString('ru-RU')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Whatsapp({ candidateId, notes, onAdd }: any) {
  const [body, setBody] = useState('')
  const send = async (direction: 'in' | 'out') => {
    if (!body.trim()) return
    await api.post(`/candidates/${candidateId}/notes`, { type: 'whatsapp', direction, body })
    setBody('')
    onAdd()
  }
  return (
    <div>
      <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        Интеграция с WhatsApp · переписка с кандидатом
      </div>
      <div className="mb-4 max-h-80 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
        {notes.length === 0 && <div className="py-6 text-center text-sm text-slate-400">Сообщений нет</div>}
        {[...notes].reverse().map((n: any) => (
          <div key={n.id} className={`flex ${n.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${n.direction === 'out' ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200'}`}>
              {n.body}
              <div className={`mt-0.5 text-[10px] ${n.direction === 'out' ? 'text-emerald-100' : 'text-slate-400'}`}>
                {new Date(n.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input" placeholder="Сообщение…" value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send('out')} />
        <button className="btn-outline" onClick={() => send('in')} title="Входящее">Вход.</button>
        <button className="btn-primary" onClick={() => send('out')}><Send size={15} /></button>
      </div>
    </div>
  )
}

function AiPanel({ analysis, onAnalyze, analyzing }: { analysis?: AiAnalysis; onAnalyze: () => void; analyzing: boolean }) {
  if (!analysis) {
    return (
      <div className="py-8 text-center">
        <Sparkles className="mx-auto mb-3 text-slate-300" size={32} />
        <p className="text-sm text-slate-500">Кандидат ещё не проанализирован.</p>
        <button className="btn-primary mt-4" onClick={onAnalyze} disabled={analyzing}>
          {analyzing ? 'Анализ…' : 'Анализировать (1 токен)'}
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-2xl font-bold text-brand-700">{analysis.score}</div>
        <div>
          <div className="font-medium">Балл соответствия</div>
          <div className="text-sm text-slate-500">{analysis.summary}</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-emerald-700">Сильные стороны</h4>
          <ul className="space-y-1 text-sm text-slate-600">{analysis.strengths.map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-rose-700">Риски / слабые стороны</h4>
          <ul className="space-y-1 text-sm text-slate-600">{analysis.risks.map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 p-4">
        <h4 className="mb-2 text-sm font-semibold">Вопросы для интервью</h4>
        <ul className="space-y-1 text-sm text-slate-600">{analysis.questions.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}</ul>
      </div>
      <div className="text-xs text-slate-400">Анализ от {new Date(analysis.created_at).toLocaleString('ru-RU')}</div>
    </div>
  )
}

function parseResumeSections(text: string): { title: string; content: string }[] {
  const HEADER = /^(опыт|experience|образование|education|навык|skill|о себе|about|личн|personal|контакт|contact|достижен|achievement|язык|language|проект|project|курс|course|сертифик|certif|рекоменд|reference|summary|профиль|profile|цель|objective|хобби|hobbies|интерес)/i
  const lines = text.split('\n')
  const sections: { title: string; content: string }[] = []
  let cur: { title: string; lines: string[] } | null = null
  for (const line of lines) {
    const t = line.trim()
    const isHeader =
      t.length > 0 && t.length < 70 &&
      (HEADER.test(t) ||
        /^[А-ЯA-Z][А-ЯA-Z\s\-\/]{3,}$/.test(t.replace(/:$/, '')) ||
        (t.endsWith(':') && t.length < 50 && !/^\d/.test(t)))
    if (isHeader) {
      if (cur) sections.push({ title: cur.title, content: cur.lines.join('\n').trim() })
      cur = { title: t.replace(/:$/, ''), lines: [] }
    } else if (cur) {
      cur.lines.push(line)
    } else if (t) {
      cur = { title: 'Информация', lines: [line] }
    }
  }
  if (cur) sections.push({ title: cur.title, content: cur.lines.join('\n').trim() })
  return sections.filter((s) => s.content.length > 0)
}

function ResumeView({ text }: { text?: string | null }) {
  if (!text) return <p className="text-sm italic text-slate-400">Текст резюме не добавлен.</p>
  if (text.startsWith('%PDF')) return (
    <span className="text-sm text-amber-600">⚠️ Обнаружен бинарный PDF. Нажмите «Загрузить PDF» выше, чтобы извлечь текст.</span>
  )
  const sections = parseResumeSections(text)
  if (sections.length <= 1) {
    return <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{text}</div>
  }
  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <div key={i}>
          <h4 className="mb-1.5 border-b border-brand-100 pb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">{s.title}</h4>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{s.content}</div>
        </div>
      ))}
    </div>
  )
}

function generateResumeHtml(c: Candidate): string {
  const esc = (s?: string | null) =>
    (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const sections = c.resume_text && !c.resume_text.startsWith('%PDF')
    ? parseResumeSections(c.resume_text)
    : []
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Резюме — ${esc(c.full_name)}</title><style>
  @page{margin:15mm 20mm}*{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#111827;line-height:1.5;background:#fff}
  .hdr{border-bottom:3px solid #2563eb;padding-bottom:10px;margin-bottom:16px}
  h1{font-size:18pt;color:#111827}
  .pos{font-size:11pt;color:#4b5563;margin-top:3px}
  .contacts{display:flex;flex-wrap:wrap;gap:5px 18px;margin-top:8px;font-size:9pt;color:#374151}
  .sec{margin-bottom:14px}
  .sec-title{font-size:8.5pt;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.7px;margin-bottom:5px;padding-bottom:2px;border-bottom:1px solid #dbeafe}
  .sec-body,.plain{white-space:pre-wrap;font-size:9.5pt;line-height:1.6;color:#1f2937}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr">
  <h1>${esc(c.full_name)}</h1>
  ${c.position ? `<div class="pos">${esc(c.position)}</div>` : ''}
  <div class="contacts">
    ${c.phone ? `<span>&#128222; ${esc(c.phone)}</span>` : ''}
    ${c.email ? `<span>&#9993; ${esc(c.email)}</span>` : ''}
    ${c.city ? `<span>&#128205; ${esc(c.city)}</span>` : ''}
    ${c.age ? `<span>&#128100; ${c.age} лет</span>` : ''}
    ${c.telegram ? `<span>&#9992; ${esc(c.telegram)}</span>` : ''}
  </div>
</div>
${sections.length > 0
  ? sections.map((s) => `<div class="sec"><div class="sec-title">${esc(s.title)}</div><div class="sec-body">${esc(s.content)}</div></div>`).join('')
  : c.resume_text && !c.resume_text.startsWith('%PDF')
    ? `<div class="plain">${esc(c.resume_text)}</div>`
    : '<p style="color:#9ca3af;font-style:italic">Текст резюме не добавлен</p>'}
</body></html>`
}
