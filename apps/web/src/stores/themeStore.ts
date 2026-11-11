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

/** Current page background (`--background`, an "h s% l%" triple) as #rrggbb. */
function backgroundHex(): string | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
  const m = raw.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/)
  if (!m) return null
  const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100]
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// Android app: paint the system bars with the page background so the app reads as one surface
// edge to edge, in light and dark mode.
function syncNativeSystemBars(mode: ThemeMode) {
  const capacitor = typeof window !== 'undefined' ? (window as any).Capacitor : null
  if (!capacitor?.isNativePlatform?.()) return
  const color = backgroundHex() ?? (mode === 'dark' ? '#202020' : '#f3f3f3')
  // Older APKs don't ship the AgencyShell plugin — ignore the rejection.
  capacitor.nativePromise?.('AgencyShell', 'setSystemBars', { color, dark: mode === 'dark' })?.catch?.(() => {})
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.documentElement.style.colorScheme = mode
  syncNativeSystemBars(mode)
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
