import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard, Users, GitBranch, Briefcase, ClipboardList,
  CalendarClock, BarChart3, Settings as SettingsIcon, LogOut, Bell, ChevronLeft, ChevronRight, Menu,
} from 'lucide-react'
import { useAuth } from '../auth'
import api from '../api'

const roleLabel: Record<string, string> = {
  admin: 'Администратор',
  recruiter: 'Рекрутер',
  manager: 'Руководитель',
}

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Главная', end: true },
  { to: '/candidates', icon: Users, label: 'Кандидаты' },
  { to: '/funnel', icon: GitBranch, label: 'Воронка' },
  { to: '/vacancies', icon: Briefcase, label: 'Вакансии' },
  { to: '/requests', icon: ClipboardList, label: 'Заявки на подбор' },
  { to: '/meetings', icon: CalendarClock, label: 'Встречи' },
  { to: '/analytics', icon: BarChart3, label: 'Аналитика' },
  { to: '/settings', icon: SettingsIcon, label: 'Настройки' },
]

interface Toast { id: number; title: string; body: string }

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('rf:sidebar') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const notifiedRef = useRef<Set<number>>(new Set())

  const addToast = (title: string, body: string) => {
    const id = Date.now()
    setToasts((t) => [...t, { id, title, body }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000)
  }

  useEffect(() => {
    localStorage.setItem('rf:sidebar', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    const check = () => {
      api.get('/meetings', { params: { per_page: 200 } }).then((r) => {
        const meetings: any[] = r.data.data ?? r.data
        const now = Date.now()
        meetings.forEach((m) => {
          const diff = new Date(m.starts_at).getTime() - now
          if (diff > 0 && diff <= 10 * 60 * 1000 && !notifiedRef.current.has(m.id)) {
            notifiedRef.current.add(m.id)
            const mins = Math.round(diff / 60000)
            addToast('Встреча через ' + mins + ' мин', m.title)
          }
        })
      }).catch(() => {})
    }
    api.get('/dashboard').then((r) => {
      const m = r.data.metrics
      setNotifCount((m.pending_requests ?? 0) + (m.interviews_today ?? 0))
    }).catch(() => {})
    check()
    const iv = setInterval(() => {
      api.get('/dashboard').then((r) => {
        const m = r.data.metrics
        setNotifCount((m.pending_requests ?? 0) + (m.interviews_today ?? 0))
      }).catch(() => {})
      check()
    }, 60000)
    return () => clearInterval(iv)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`flex h-16 items-center border-b border-slate-200 ${collapsed ? 'justify-center px-3' : 'gap-2.5 px-5'}`}>
        <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-brand-600 text-white font-bold">R</div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-semibold leading-tight">RecruitFlow</div>
            <div className="text-[11px] text-slate-400 leading-tight">Alina Group</div>
          </div>
        )}
        {!collapsed && (
          <NavLink to="/requests" className="relative p-1.5 text-slate-400 hover:text-slate-700" title="Уведомления">
            <Bell size={18} />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-0.5 text-[10px] font-bold text-white">
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </NavLink>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            title={collapsed ? n.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${collapsed ? 'justify-center' : ''} ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <n.icon size={18} className="flex-shrink-0" />
            {!collapsed && n.label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-200 p-2">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-600 text-sm font-semibold">
              {user?.name?.charAt(0) ?? '?'}
            </div>
            <button onClick={handleLogout} className="btn-ghost p-1.5" title="Выйти"><LogOut size={15} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-slate-600 text-sm font-semibold flex-shrink-0">
              {user?.name?.charAt(0) ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user?.name}</div>
              <div className="text-[11px] text-slate-400">{roleLabel[user?.role ?? '']}</div>
            </div>
            <button onClick={handleLogout} className="btn-ghost p-2" title="Выйти"><LogOut size={16} /></button>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((x) => !x)}
        className="flex w-full items-center justify-center border-t border-slate-100 py-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors text-xs gap-1"
      >
        {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Свернуть</span></>}
      </button>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col border-r border-slate-200 bg-white transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-64 flex flex-col border-r border-slate-200 bg-white">
            {sidebarContent}
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between border-b border-slate-200 bg-white px-4 h-14">
          <button onClick={() => setMobileOpen(true)} className="btn-ghost p-2"><Menu size={18} /></button>
          <span className="font-semibold">RecruitFlow</span>
          <button onClick={handleLogout} className="btn-ghost p-2"><LogOut size={16} /></button>
        </header>
        <main className="flex-1 overflow-y-auto p-5 md:p-8">
          <Outlet />
        </main>
      </div>

      {/* Toast notifications (bottom-right) */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-brand-200 bg-white p-3 shadow-lg animate-in slide-in-from-right">
            <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-brand-50">
              <CalendarClock size={16} className="text-brand-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{t.title}</p>
              <p className="text-xs text-slate-500 truncate">{t.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
