import { useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'

/** Small notice while the device is offline: the screens keep working with the saved data. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-[13px] font-medium text-warning-dark dark:text-warning">
      <CloudOff size={15} aria-hidden />
      Sem ligação · a mostrar os dados guardados
    </div>
  )
}
