import * as ToastPrimitive from '@radix-ui/react-toast'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToastStore, type ToastVariant } from '@/lib/toast'

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const ICON_STYLES: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-error',
  info: 'text-primary',
}

/** Mounted once near the app root. Renders every toast currently in `useToastStore`,
 *  replacing `alert()` across the app with a non-blocking, professional notification. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
      {toasts.map((t) => {
        const Icon = ICONS[t.variant]
        return (
          <ToastPrimitive.Root
            key={t.id}
            open
            onOpenChange={(open) => { if (!open) dismiss(t.id) }}
            className={cn(
              'flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-dialog w-full',
              'data-[state=open]:animate-fade-in data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]'
            )}
          >
            <Icon size={18} className={cn('shrink-0 mt-0.5', ICON_STYLES[t.variant])} />
            <div className="flex-1 min-w-0 space-y-0.5">
              <ToastPrimitive.Title className="text-sm font-bold text-foreground leading-snug">
                {t.title}
              </ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="text-xs text-muted-foreground font-medium leading-snug">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="shrink-0 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X size={14} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex flex-col gap-2.5 p-4 sm:p-6 w-full sm:max-w-sm max-h-screen overflow-hidden outline-none" />
    </ToastPrimitive.Provider>
  )
}
