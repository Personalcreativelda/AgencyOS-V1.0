import { useEffect, useRef, useState, type RefObject } from 'react'

const TRIGGER = 72 // px of (dampened) pull needed to refresh
const MAX = 96

/**
 * Pull-to-refresh on a scroll container (touch only), like native Android apps: pull down from
 * the very top, release past the threshold → `onRefresh`. Ignored inside horizontal scrollers,
 * open sheets/dialogs and anything marked `data-no-ptr`.
 */
export function usePullToRefresh(ref: RefObject<HTMLElement>, onRefresh: () => Promise<unknown> | void) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const start = useRef<{ y: number; x: number } | null>(null)
  const latest = useRef(0)
  const busy = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia('(pointer: coarse)').matches) return

    const onStart = (e: TouchEvent) => {
      if (busy.current || el.scrollTop > 0) return
      const target = e.target as HTMLElement
      if (target.closest('[data-no-ptr], [role="dialog"], [role="menu"], [role="listbox"]')) return
      if (document.querySelector('[role="dialog"][data-state="open"]')) return
      start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX }
    }
    const onMove = (e: TouchEvent) => {
      if (!start.current) return
      const dy = e.touches[0].clientY - start.current.y
      const dx = Math.abs(e.touches[0].clientX - start.current.x)
      if (dy <= 0 || dx > dy || el.scrollTop > 0) { start.current = null; latest.current = 0; setPull(0); return }
      const dampened = Math.min(MAX, dy * 0.45)
      latest.current = dampened
      setPull(dampened)
    }
    const onEnd = async () => {
      if (!start.current) return
      start.current = null
      if (latest.current >= TRIGGER) {
        busy.current = true
        setRefreshing(true)
        setPull(TRIGGER * 0.75)
        try { await onRefresh() } finally {
          busy.current = false
          setRefreshing(false)
        }
      }
      latest.current = 0
      setPull(0)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [ref, onRefresh])

  return { pull, refreshing, progress: Math.min(1, pull / TRIGGER) }
}
