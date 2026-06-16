import { useEffect, useState } from 'react'
import { Plus, Trash2, Eye, EyeOff, Code2 } from 'lucide-react'
import api from '../api'
import { User, Department } from '../types'
import { Modal, PageHeader } from '../components/ui'
import { useAuth } from '../auth'

const roleLabel: Record<string, string> = { admin: 'Администратор', recruiter: 'Рекрутер', manager: 'Руководитель' }

export default function Settings() {
  const { user } = useAuth()
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', position: '', password: '' })
  const [saved, setSaved] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [devMode, setDevMode] = useState(() => localStorage.getItem('rf:devmode') === '1')

  const toggleDevMode = (v: boolean) => {
    setDevMode(v)
    localStorage.setItem('rf:devmode', v ? '1' : '0')
  }

  useEffect(() => {
    if (user) setProfile({ name: user.name, email: user.email, phone: user.phone ?? '', position: user.position ?? '', password: '' })
  }, [user])

  const saveProfile = async () => {
    const payload: any = { ...profile }
    if (!payload.password) delete payload.password
    await api.put('/profile', payload)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Настройки" subtitle="Профиль и управление пользователями" />

      <div className="card p-6">
        <h3 className="font-semibold">Мой профиль</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="label">Имя</label><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
          <div><label className="label">Телефон</label><input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
          <div><label className="label">Должность</label><input className="input" value={profile.position} onChange={(e) => setProfile({ ...profile, position: e.target.value })} /></div>
          <div>
            <label className="label">Новый пароль</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} className="input pr-10" value={profile.password} onChange={(e) => setProfile({ ...profile, password: e.target.value })} placeholder="оставьте пустым" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPwd((x) => !x)}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" onClick={saveProfile}>Сохранить</button>
          {saved && <span className="text-sm text-emerald-600">Сохранено</span>}
        </div>
      </div>

      {user?.role === 'admin' && <UsersManagement />}

      {user?.role === 'admin' && (
        <div className="card mt-6 p-6">
          <div className="flex items-center gap-3">
            <Code2 size={20} className="text-slate-400" />
            <div className="flex-1">
              <h3 className="font-semibold">Режим разработчика</h3>
              <p className="text-sm text-slate-500">Отображает дополнительные технические данные. Только для администраторов.</p>
            </div>
            <button
              onClick={() => toggleDevMode(!devMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                devMode ? 'bg-brand-600' : 'bg-slate-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                devMode ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          {devMode && (
            <div className="mt-4 rounded-lg bg-slate-800 p-4 text-xs font-mono text-slate-300">
              <div>devMode: <span className="text-emerald-400">true</span></div>
              <div>user.id: <span className="text-amber-400">{user?.id}</span></div>
              <div>user.role: <span className="text-amber-400">{user?.role}</span></div>
              <div>API: <span className="text-sky-400">{window.location.origin.replace('5173','8000')}/api</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UsersManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'recruiter', position: '', phone: '', department_id: '' })

  const load = () => api.get('/users').then((r) => setUsers(r.data))
  useEffect(() => { load(); api.get('/departments').then((r) => setDepartments(r.data)) }, [])

  const create = async () => {
    await api.post('/users', { ...form, department_id: form.department_id || null })
    setShow(false)
    setForm({ name: '', email: '', password: '', role: 'recruiter', position: '', phone: '', department_id: '' })
    load()
  }
  const remove = async (id: number) => {
    if (!confirm('Удалить пользователя?')) return
    await api.delete(`/users/${id}`)
    load()
  }

  return (
    <div className="card mt-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <h3 className="font-semibold">Рекрутеры и пользователи</h3>
        <button className="btn-primary" onClick={() => setShow(true)}><Plus size={16} /> Добавить</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
          <tr>
            <th className="px-5 py-3 font-medium">Имя</th>
            <th className="px-5 py-3 font-medium">Email</th>
            <th className="px-5 py-3 font-medium">Роль</th>
            <th className="px-5 py-3 font-medium">Должность</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-5 py-3 font-medium">{u.name}</td>
              <td className="px-5 py-3 text-slate-500">{u.email}</td>
              <td className="px-5 py-3"><span className="badge bg-slate-100 text-slate-700">{roleLabel[u.role]}</span></td>
              <td className="px-5 py-3 text-slate-500">{u.position}</td>
              <td className="px-5 py-3 text-right">
                <button className="btn-ghost p-2 text-slate-400 hover:text-rose-600" onClick={() => remove(u.id)}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal open={show} onClose={() => setShow(false)} title="Новый пользователь">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Имя *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Email *</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Пароль *</label><input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><label className="label">Роль</label><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{Object.entries(roleLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="label">Должность</label><input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
          <div><label className="label">Подразделение</label><select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setShow(false)}>Отмена</button>
          <button className="btn-primary" disabled={!form.name || !form.email || !form.password} onClick={create}>Создать</button>
        </div>
      </Modal>
    </div>
  )
}
