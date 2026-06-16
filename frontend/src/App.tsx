import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Candidates from './pages/Candidates'
import CandidateDetail from './pages/CandidateDetail'
import Funnel from './pages/Funnel'
import Vacancies from './pages/Vacancies'
import VacancyDetail from './pages/VacancyDetail'
import HiringRequests from './pages/HiringRequests'
import Meetings from './pages/Meetings'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-slate-400">Загрузка…</div>
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="candidates" element={<Candidates />} />
        <Route path="candidates/:id" element={<CandidateDetail />} />
        <Route path="funnel" element={<Funnel />} />
        <Route path="vacancies" element={<Vacancies />} />
        <Route path="vacancies/:id" element={<VacancyDetail />} />
        <Route path="requests" element={<HiringRequests />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
