import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState()
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Any write (create, update, delete, sync…) can change what a cached read returns.
  if (config.method && config.method.toLowerCase() !== 'get') readCache.clear()
  return config
})

// ─── Short-lived read cache ───────────────────────────────────────────────────────────────
// Pages that used to re-query everything on every visit (Meta Ads, Google, Relatórios…) read
// through this, so coming back to a page is instant. Entries live 2 minutes, are scoped to the
// signed-in user and are dropped on any write request — never stale after an action.
type CacheEntry = { at: number; promise: Promise<any> }
const readCache = new Map<string, CacheEntry>()
const READ_TTL = 2 * 60 * 1000

export function clearReadCache() {
  readCache.clear()
}

export function cachedGet<T = any>(url: string, config: { params?: Record<string, unknown>; signal?: AbortSignal } = {}) {
  const user = useAuthStore.getState().user?.id || 'anon'
  const key = `${user}|${url}|${JSON.stringify(config.params || {})}`
  const hit = readCache.get(key)
  if (hit && Date.now() - hit.at < READ_TTL) return hit.promise as Promise<{ data: T }>
  // The shared request is not tied to one page's AbortSignal, so leaving a page never poisons
  // the cache with an aborted request.
  const promise = api.get<T>(url, { params: config.params }).then((res) => ({ data: res.data }))
  readCache.set(key, { at: Date.now(), promise })
  promise.catch(() => readCache.delete(key))
  return promise
}

// Auto-refresh on 401. The backend rotates refresh tokens (each one is single-use, deleted the
// moment it's redeemed) — if two requests 401 around the same time (e.g. the notifications poll
// racing another call), firing two independent /auth/refresh calls with the same token means
// only the first succeeds; the second gets 'Invalid or expired refresh token' and would log the
// user out for no real reason. Sharing one in-flight refresh promise across concurrent 401s fixes
// that: everyone awaits the same call instead of each redeeming (and invalidating) their own.
function readSavedSession(): { token?: string; refreshToken?: string } | null {
  try {
    return JSON.parse(localStorage.getItem('agencyflow-auth') || 'null')?.state ?? null
  } catch {
    return null
  }
}

// Keep tabs in sync: when one tab refreshes or logs out, the others pick up the new session.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'agencyflow-auth') void useAuthStore.persist.rehydrate()
  })
}

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const { refreshToken, setAuth, logout } = useAuthStore.getState()
      if (refreshToken) {
        try {
          if (!refreshPromise) {
            refreshPromise = axios.post('/api/v1/auth/refresh', { refreshToken })
              .then((res) => res.data)
              .finally(() => { refreshPromise = null })
          }
          const data = await refreshPromise
          const current = useAuthStore.getState()
          setAuth(data.accessToken, data.refreshToken, current.user!)
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return api(original)
        } catch (refreshError: any) {
          // No connection / server restarting: keep the session (offline mode shows saved data)
          // and just fail this request. Only a real "refresh token rejected" ends the session.
          if (!refreshError?.response) return Promise.reject(error)
          // Another tab may have rotated the token a moment ago and saved the new pair —
          // adopt it instead of logging out.
          const saved = readSavedSession()
          if (saved?.token && saved.refreshToken && saved.refreshToken !== refreshToken) {
            const current = useAuthStore.getState()
            setAuth(saved.token, saved.refreshToken, current.user!)
            original.headers.Authorization = `Bearer ${saved.token}`
            return api(original)
          }
          logout()
          window.location.href = '/login'
        }
      } else {
        logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
