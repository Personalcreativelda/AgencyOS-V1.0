import type { Navigator } from 'react-router-dom'

export interface NavigationGuardState {
  dirty: boolean
  skip: boolean
  committed: { index?: number; pathname: string }
}

type GuardBrowser = Pick<Window, 'history' | 'location' | 'addEventListener' | 'removeEventListener'>

/** Adapt BrowserRouter's existing navigator; no router, route or history entries are replaced. */
export function installNavigationGuard(navigator: Navigator, browser: GuardBrowser, state: NavigationGuardState, confirmLeave: () => Promise<boolean>) {
  let pending = false
  const original = { push: navigator.push, replace: navigator.replace, go: navigator.go }
  const confirm = async (proceed: () => void) => {
    if (pending) return
    pending = true
    try {
      const leave = await confirmLeave()
      if (leave) proceed()
    } finally { pending = false }
  }
  const leaving = (to: Parameters<typeof navigator.push>[0]) => {
    const href = navigator.createHref(to)
    return new URL(href, browser.location.href).pathname !== state.committed.pathname
  }
  const push: typeof navigator.push = (...args) => {
    if (!state.dirty || state.skip || !leaving(args[0])) original.push.apply(navigator, args)
    else void confirm(() => original.push.apply(navigator, args))
  }
  const replace: typeof navigator.replace = (...args) => {
    if (!state.dirty || state.skip || !leaving(args[0])) original.replace.apply(navigator, args)
    else void confirm(() => original.replace.apply(navigator, args))
  }
  let allowedPop = false
  const go: typeof navigator.go = delta => {
    if (!state.dirty || state.skip) original.go.call(navigator, delta)
    else void confirm(() => { allowedPop = true; original.go.call(navigator, delta) })
  }
  navigator.push = push; navigator.replace = replace; navigator.go = go

  let restoring = false
  let pendingDelta: number | null = null
  // Capture precedes BrowserRouter's pop listener: restore the current entry before asking.
  const onPop = (event: PopStateEvent) => {
    if (allowedPop || state.skip) { allowedPop = false; return }
    if (restoring) {
      event.stopImmediatePropagation()
      restoring = false
      const delta = pendingDelta
      pendingDelta = null
      if (!pending && delta !== null) void confirm(() => { allowedPop = true; original.go.call(navigator, delta) })
      return
    }
    if (!state.dirty || browser.location.pathname === state.committed.pathname) return
    const nextIndex = browser.history.state?.idx
    const currentIndex = state.committed.index
    if (typeof nextIndex !== 'number' || typeof currentIndex !== 'number' || nextIndex === currentIndex) return
    event.stopImmediatePropagation()
    const delta = nextIndex - currentIndex
    if (pendingDelta === null) pendingDelta = delta
    restoring = true
    browser.history.go(-delta)
  }
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!state.dirty || state.skip) return
    event.preventDefault(); event.returnValue = ''
  }
  browser.addEventListener('popstate', onPop, true)
  browser.addEventListener('beforeunload', beforeUnload)
  return () => {
    if (navigator.push === push) navigator.push = original.push
    if (navigator.replace === replace) navigator.replace = original.replace
    if (navigator.go === go) navigator.go = original.go
    browser.removeEventListener('popstate', onPop, true)
    browser.removeEventListener('beforeunload', beforeUnload)
  }
}
