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
  close: () => void
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}))

/** Promise-based replacement for `window.confirm()` — resolves `true`/`false` the same way,
 *  so existing `if (!(await confirmDialog({...}))) return` call sites read almost identically
 *  to the old `if (!confirm('...')) return`, but render our own styled dialog instead of the
 *  browser's native (and visibly unprofessional) confirm box. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().open({ ...options, resolve })
  })
}
