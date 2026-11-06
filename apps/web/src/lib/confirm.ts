import { create } from 'zustand'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** 'destructive' renders the confirm button in the error color (deletions, irreversible actions). */
  variant?: 'default' | 'destructive'
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (value: boolean) => void
}

interface ConfirmState {
  request: ConfirmRequest | null
  open: (request: ConfirmRequest) => void
  settle: (value: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  open: (request) => {
    // A new confirmation replaces any pending one — resolve the old promise as "cancelled"
    // so its caller doesn't hang forever.
    get().request?.resolve(false)
    set({ request })
  },
  settle: (value) => {
    const { request } = get()
    if (!request) return
    request.resolve(value)
    set({ request: null })
  },
}))

/** Promise-based replacement for `window.confirm()` — resolves `true`/`false` the same way,
 *  so call sites read `if (!(await confirmDialog({...}))) return`, but render our own styled
 *  dialog instead of the browser's native confirm box. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().open({ ...options, resolve })
  })
}
