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
  return config
})

// Auto-refresh on 401. The backend rotates refresh tokens (each one is single-use, deleted the
// moment it's redeemed) — if two requests 401 around the same time (e.g. the notifications poll
// racing another call), firing two independent /auth/refresh calls with the same token means
// only the first succeeds; the second gets 'Invalid or expired refresh token' and would log the
// user out for no real reason. Sharing one in-flight refresh promise across concurrent 401s fixes
// that: everyone awaits the same call instead of each redeeming (and invalidating) their own.
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
        } catch {
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
