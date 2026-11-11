import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Android hardware/gesture "back" inside the Capacitor app, the way native apps behave:
 *   1. an open dialog, sheet, dropdown or popover closes first;
 *   2. then the side menu (drawer), if open;
 *   3. then the previous screen (or Início when there is no in-app history);
 *   4. on Início itself the app is sent to the background (not killed), like Gmail or Drive.
 * In a normal browser this does nothing — the browser's own back button already works.
 */
export function useAndroidBack({ menuOpen, closeMenu }: { menuOpen: boolean; closeMenu: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const state = useRef({ menuOpen, closeMenu, pathname })
  state.current = { menuOpen, closeMenu, pathname }

  useEffect(() => {
    const capacitor = (window as any).Capacitor
    const App = capacitor?.isNativePlatform?.() ? capacitor.Plugins?.App : null
    if (!App?.addListener) return

    let handle: { remove: () => void } | undefined
    let disposed = false
    Promise.resolve(App.addListener('backButton', () => {
      // 1. Any Radix layer (Dialog, bottom sheet, DropdownMenu, Select, Popover) closes on Escape.
      const layer = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-radix-popper-content-wrapper], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]')
      if (layer) {
        const target = (document.activeElement as HTMLElement | null) || document.body
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
        return
      }
      // 2. Side menu.
      if (state.current.menuOpen) {
        state.current.closeMenu()
        return
      }
      // 3. Previous screen, or Início when the history starts here (deep link, notification…).
      if (state.current.pathname !== '/app/dashboard') {
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
        if (idx > 0) navigate(-1)
        else navigate('/app/dashboard', { replace: true })
        return
      }
      // 4. Root screen: background the app.
      App.minimizeApp?.()
    })).then((h: any) => {
      if (disposed) h?.remove?.()
      else handle = h
    })

    return () => {
      disposed = true
      handle?.remove()
    }
  }, [navigate])
}
