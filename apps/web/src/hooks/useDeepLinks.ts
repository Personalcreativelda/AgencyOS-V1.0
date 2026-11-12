import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Android App Links / agencyos:// links: when a link to AgencyOS is tapped (WhatsApp, e-mail…)
 * the OS opens the app and Capacitor emits `appUrlOpen` — route to that screen inside the app
 * instead of reloading. No-op in the browser.
 */
export function useDeepLinks() {
  const navigate = useNavigate()
  useEffect(() => {
    const capacitor = (window as any).Capacitor
    const App = capacitor?.isNativePlatform?.() ? capacitor.Plugins?.App : null
    if (!App?.addListener) return
    let handle: { remove: () => void } | undefined
    let disposed = false
    Promise.resolve(App.addListener('appUrlOpen', ({ url }: { url: string }) => {
      try {
        const u = new URL(url)
        // https://agencyos…/approval/abc  or  agencyos://approval/abc
        const path = u.protocol === 'agencyos:' ? `/${u.host}${u.pathname}` : u.pathname
        if (path && path !== '/') navigate(`${path}${u.search}${u.hash}`)
      } catch { /* malformed link: ignore */ }
    })).then((h: any) => { if (disposed) h?.remove?.(); else handle = h })
    return () => { disposed = true; handle?.remove() }
  }, [navigate])
}
