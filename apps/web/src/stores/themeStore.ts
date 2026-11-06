import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'
export type ThemePreference = ThemeMode | 'system'

interface ThemeState {
  preference: ThemePreference
  /** Resolved colour mode, also used by social previews. */
  mode: ThemeMode
  toggle: () => void
  setMode: (preference: ThemePreference) => void
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const resolveMode = (preference: ThemePreference): ThemeMode =>
  preference === 'system' ? (media?.matches ? 'dark' : 'light') : preference

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.documentElement.style.colorScheme = mode
}

function readPreference(value: unknown): ThemePreference {
  const preference = (value as { preference?: unknown } | null)?.preference
  return preference === 'light' || preference === 'dark' ? preference : 'system'
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: 'system',
      mode: resolveMode('system'),
      toggle: () => get().setMode(get().mode === 'dark' ? 'light' : 'dark'),
      setMode: (preference) => {
        const mode = resolveMode(preference)
        applyTheme(mode)
        set({ preference, mode })
      },
    }),
    {
      name: 'agencyos-theme',
      version: 1,
      partialize: ({ preference }) => ({ preference }),
      // Old installations had a stored light/dark mode with no system option.
      // Start those installations on system too, instead of retaining a stale default.
      migrate: (stored) => ({ preference: readPreference(stored) }),
      merge: (stored, current) => {
        const preference = readPreference(stored)
        return { ...current, preference, mode: resolveMode(preference) }
      },
    }
  )
)

applyTheme(useThemeStore.getState().mode)

const followSystem = () => {
  if (useThemeStore.getState().preference !== 'system') return
  const mode = resolveMode('system')
  applyTheme(mode)
  useThemeStore.setState({ mode })
}
media?.addEventListener('change', followSystem)

// Keep already-open tabs on the same explicit preference.
const syncPreference = (event: StorageEvent) => {
  if (event.key !== 'agencyos-theme' && event.key !== null) return
  try {
    const preference = readPreference(event.newValue ? JSON.parse(event.newValue)?.state : null)
    if (preference !== useThemeStore.getState().preference) useThemeStore.getState().setMode(preference)
  } catch { /* Ignore malformed storage written outside the app. */ }
}
if (typeof window !== 'undefined') window.addEventListener('storage', syncPreference)

// Avoid duplicate subscriptions when Vite updates this module during development.
if (import.meta.hot) import.meta.hot.dispose(() => {
  media?.removeEventListener('change', followSystem)
  window.removeEventListener('storage', syncPreference)
})
