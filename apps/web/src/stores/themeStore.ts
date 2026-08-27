import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ThemeMode = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  toggle: () => void
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      toggle: () => {
        const next = get().mode === 'light' ? 'dark' : 'light'
        set({ mode: next })
        applyTheme(next)
      },
      setMode: (mode) => {
        set({ mode })
        applyTheme(mode)
      },
    }),
    {
      name: 'agencyos-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.mode)
      },
    }
  )
)

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// Initialize on load
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('agencyos-theme')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      applyTheme(parsed.state?.mode || 'light')
    } catch {
      applyTheme('light')
    }
  }
}
