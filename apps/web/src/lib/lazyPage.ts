import { lazy, type ComponentType } from 'react'

const RELOAD_KEY = 'agencyos-chunk-reload'

/**
 * React.lazy for named page exports, resilient to deploys: when the app was loaded before a new
 * deploy, its old chunk files no longer exist on the server and the import fails. In that case
 * reload once to pick up the new build (guarded so it can never loop).
 */
export function lazyPage<T extends ComponentType<any>>(loader: () => Promise<Record<string, unknown>>, name: string) {
  return lazy(async () => {
    try {
      const mod = await loader()
      sessionStorage.removeItem(RELOAD_KEY)
      return { default: mod[name] as T }
    } catch (error) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1')
        window.location.reload()
        return new Promise<never>(() => {})
      }
      throw error
    }
  })
}
