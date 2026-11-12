/**
 * Haptic feedback, like native Android apps (tab switch, primary actions, success/error).
 * Uses the Capacitor Haptics plugin when the installed APK has it; otherwise the Web Vibration
 * API; otherwise does nothing. Never throws, never blocks.
 */
type Impact = 'LIGHT' | 'MEDIUM' | 'HEAVY'
type Notice = 'SUCCESS' | 'WARNING' | 'ERROR'

function plugin(): any {
  const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null
  return cap?.isNativePlatform?.() ? cap.Plugins?.Haptics : null
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* not supported */ }
}

function impact(style: Impact, fallback: number) {
  const p = plugin()
  if (p?.impact) { Promise.resolve(p.impact({ style })).catch(() => vibrate(fallback)); return }
  vibrate(fallback)
}

function notify(type: Notice, fallback: number[]) {
  const p = plugin()
  if (p?.notification) { Promise.resolve(p.notification({ type })).catch(() => vibrate(fallback)); return }
  vibrate(fallback)
}

export const haptics = {
  /** Tab switch, toggles, picking an option. */
  selection: () => { const p = plugin(); if (p?.selectionChanged) { Promise.resolve(p.selectionStart?.()).then(() => p.selectionChanged()).catch(() => {}); return } vibrate(8) },
  /** Primary button / FAB. */
  tap: () => impact('LIGHT', 10),
  /** Drag picked up, destructive confirm. */
  heavy: () => impact('MEDIUM', 18),
  success: () => notify('SUCCESS', [12, 40, 18]),
  error: () => notify('ERROR', [24, 50, 24, 50, 24]),
}
