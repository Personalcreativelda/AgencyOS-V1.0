import { useCallback, useContext, useEffect, useRef } from 'react'
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom'
import { confirmDialog } from '@/lib/confirm'
import { installNavigationGuard, type NavigationGuardState } from '@/components/content/navigationGuard'

/** BrowserRouter has no data-router blocker. Preserve its routes and guard its navigator. */
export function useUnsavedChanges(enabled: boolean) {
  const { navigator } = useContext(UNSAFE_NavigationContext)
  const location = useLocation()
  const state = useRef<NavigationGuardState>({
    dirty: enabled, skip: false,
    committed: { index: window.history.state?.idx, pathname: location.pathname },
  })
  state.current.dirty = enabled
  useEffect(() => {
    state.current.committed = { index: window.history.state?.idx, pathname: location.pathname }
    state.current.skip = false
  }, [location.key, location.pathname])

  const allowNextNavigation = useCallback(() => { state.current.skip = true }, [])
  useEffect(() => installNavigationGuard(navigator, window, state.current, () => confirmDialog({
    title: 'Alterações por guardar',
    description: 'Tem alterações ou um comentário por enviar. Se sair agora, esse trabalho não será guardado.',
    confirmLabel: 'Sair sem guardar', cancelLabel: 'Continuar a editar', variant: 'destructive',
  })), [navigator])
  return allowNextNavigation
}
