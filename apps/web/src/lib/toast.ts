import { create } from 'zustand'
import { haptics } from '@/lib/haptics'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  /** e.g. "Desfazer" — runs the callback and dismisses the toast. */
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  toasts: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: Math.random().toString(36).slice(2) }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

type ToastOptions = { action?: ToastItem['action'] }

function push(variant: ToastVariant, title: string, description?: string, options?: ToastOptions) {
  if (variant === 'success') haptics.success()
  if (variant === 'error') haptics.error()
  useToastStore.getState().push({ variant, title, description, action: options?.action })
}

/** Global toast API — usable from anywhere (components, async handlers, the axios
 *  interceptor), not just inside React render. Replaces `alert()` across the app. */
export const toast = {
  success: (title: string, description?: string, options?: ToastOptions) => push('success', title, description, options),
  error: (title: string, description?: string, options?: ToastOptions) => push('error', title, description, options),
  info: (title: string, description?: string, options?: ToastOptions) => push('info', title, description, options),
}
