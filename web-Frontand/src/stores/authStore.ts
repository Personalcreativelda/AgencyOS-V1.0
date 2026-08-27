import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Agency {
  id: string
  name: string
  slug: string
  logoUrl?: string
}

interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
  role: string
  agency: Agency
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  setAuth: (token: string, refreshToken: string, user: User) => void
  updateUser: (user: Partial<User>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
      updateUser: (data) => set((s) => ({ user: s.user ? { ...s.user, ...data } : null })),
      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    {
      name: 'agencyflow-auth',
    }
  )
)
