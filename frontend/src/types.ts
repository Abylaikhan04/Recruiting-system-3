export type Role = 'admin' | 'recruiter' | 'manager'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  position?: string
  phone?: string
  department_id?: number | null
  department?: Department | null
}

export interface Department {
  id: number
  name: string
  city?: string
}

export type Stage =
  | 'new' | 'screening' | 'phone' | 'tech' | 'final' | 'offer' | 'hired' | 'rejected'

export interface Candidate {
  id: number
  full_name: string
  phone?: string
  email?: string
  organization?: string
  city?: string
  department?: string
  position: string
  source?: string
  stage: Stage
  status: string
  rejection_reason?: string
  comment?: string
  resume_text?: string
  resume_url?: string
  age?: number | null
  telegram?: string | null
  vacancy_id?: number | null
  recruiter_id?: number | null
  recruiter?: { id: number; name: string }
  vacancy?: { id: number; title: string }
  latest_analysis?: { id: number; score: number } | null
  notes?: CandidateNote[]
  history?: CandidateHistory[]
  analyses?: AiAnalysis[]
  created_at?: string
  updated_at?: string
}

export interface CandidateNote {
  id: number
  type: 'note' | 'whatsapp'
  direction?: 'in' | 'out'
  body: string
  user?: { id: number; name: string }
  created_at: string
}

export interface CandidateHistory {
  id: number
  field: string
  from_value?: string
  to_value?: string
  user?: { id: number; name: string }
  created_at: string
}

export interface AiAnalysis {
  id: number
  score: number
  strengths: string[]
  risks: string[]
  questions: string[]
  summary: string
  created_at: string
}

export interface Vacancy {
  id: number
  title: string
  city?: string
  position?: string
  salary_range?: string
  description?: string
  requirements?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'paused' | 'closed'
  department?: { id: number; name: string }
  recruiter?: { id: number; name: string }
  candidates_count?: number
}

export interface HiringRequest {
  id: number
  title: string
  city?: string
  position: string
  headcount: number
  description?: string
  requirements?: string
  salary_range?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'pending' | 'approved' | 'rejected' | 'in_progress' | 'closed'
  department?: { id: number; name: string }
  requester?: { id: number; name: string }
  recruiter?: { id: number; name: string }
  created_at?: string
}

export interface Meeting {
  id: number
  title: string
  starts_at: string
  duration_min: number
  location?: string
  notes?: string
  done?: number | boolean
  candidate_id?: number | null
  candidate?: { id: number; full_name: string }
}

export const STAGES: { value: Stage; label: string; color: string }[] = [
  { value: 'new', label: 'Новый отклик', color: 'bg-slate-100 text-slate-700' },
  { value: 'screening', label: 'Скрининг резюме', color: 'bg-sky-100 text-sky-700' },
  { value: 'phone', label: 'Телефонное интервью', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'tech', label: 'Техническое интервью', color: 'bg-violet-100 text-violet-700' },
  { value: 'final', label: 'Финальное интервью', color: 'bg-amber-100 text-amber-700' },
  { value: 'offer', label: 'Оффер отправлен', color: 'bg-teal-100 text-teal-700' },
  { value: 'hired', label: 'Принят', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'rejected', label: 'Отказ', color: 'bg-rose-100 text-rose-700' },
]

export const stageLabel = (s: string) => STAGES.find((x) => x.value === s)?.label ?? s
export const stageColor = (s: string) => STAGES.find((x) => x.value === s)?.color ?? 'bg-slate-100 text-slate-700'

export const SOURCES = ['hh.kz', 'OLX.kz', 'Qyzmet.kz', 'LinkedIn', 'Реферал', 'Вручную', 'По ссылке']
