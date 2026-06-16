import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../auth'

const demoAccounts = [
  { role: 'Админ рекрутеров', email: 'admin@alinagroup.kz' },
  { role: 'Рекрутер', email: 'recruiter@alinagroup.kz' },
  { role: 'Начальник IT отдела', email: 'it-lead@alinagroup.kz' },
  { role: 'Руководитель склада', email: 'warehouse@alinagroup.kz' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@alinagroup.kz')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-brand-700 p-12 text-white">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/15 font-bold">R</div>
          <span className="text-lg font-semibold">RecruitFlow</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-snug">
            Система подбора персонала<br />для Alina Group
          </h1>
          <p className="mt-4 max-w-md text-brand-100">
            Управляйте вакансиями, заявками на подбор, кандидатами и воронкой найма.
            ИИ-анализ резюме, встречи и аналитика — в одном месте.
          </p>
        </div>
        <p className="text-sm text-brand-200">© {new Date().getFullYear()} Alina Group · On-premise</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Вход</h2>
          <p className="mt-1 text-sm text-slate-500">Войдите в свою учётную запись</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
            <div>
              <label className="label">Пароль</label>
              <div className="relative">
                <input className="input pr-10" value={password} onChange={(e) => setPassword(e.target.value)} type={showPwd ? 'text' : 'password'} required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPwd((x) => !x)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Вход…' : 'Войти'}
            </button>
          </form>

          <div className="mt-8">
            <p className="text-xs font-medium text-slate-400">Демо-аккаунты (пароль: password)</p>
            <div className="mt-2 space-y-1.5">
              {demoAccounts.map((a) => (
                <button
                  key={a.email}
                  onClick={() => { setEmail(a.email); setPassword('password') }}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="text-slate-600">{a.role}</span>
                  <span className="text-xs text-slate-400">{a.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
