import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import api from './api'
import { User } from './types'

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as any)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('rf_token')
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get<User>('/me')
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem('rf_token'))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const r = await api.post('/login', { email, password })
    localStorage.setItem('rf_token', r.data.token)
    setUser(r.data.user)
  }

  const logout = async () => {
    try {
      await api.post('/logout')
    } catch {
      /* ignore */
    }
    localStorage.removeItem('rf_token')
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
