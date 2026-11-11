import { registerSW } from 'virtual:pwa-register'

/**
 * Offline support: registers the service worker that keeps the app shell, the last API reads and
 * images on the device (see vite.config.ts).
 *
 * Updates never reload the app in the middle of work: a new version is applied right away only
 * during the first seconds after opening (nothing typed yet), otherwise the next time the app
 * goes to the background.
 */
export function setupServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  const openedAt = Date.now()
  let pending = false

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (Date.now() - openedAt < 8000 || document.visibilityState === 'hidden') {
        void updateSW(true)
      } else {
        pending = true
      }
    },
    onRegisteredSW(_url, registration) {
      // Look for a new version whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration?.update()
      })
    },
  })

  document.addEventListener('visibilitychange', () => {
    if (pending && document.visibilityState === 'hidden') {
      pending = false
      void updateSW(true)
    }
  })
}

/** Removes saved API data and images (on logout, so the next person on this device sees nothing). */
export async function clearOfflineData() {
  if (!('caches' in window)) return
  await Promise.all(['agencyos-api', 'agencyos-images'].map((name) => caches.delete(name).catch(() => false)))
}
