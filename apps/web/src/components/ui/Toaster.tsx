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
  success: 'bg-success/10 text-success-dark dark:text-success',
  error: 'bg-error/10 text-error-dark dark:text-error',
  info: 'bg-info/10 text-info-dark dark:text-info',
}

const BAR: Record<ToastVariant, string> = {
  success: 'before:bg-success',
  error: 'before:bg-error',
  info: 'before:bg-info',
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
              'relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 pl-5 shadow-dialog',
              'before:absolute before:inset-y-0 before:left-0 before:w-1', BAR[t.variant],
              'data-[state=open]:animate-fade-in data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]'
            )}
          >
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', ICON_STYLES[t.variant])}><Icon size={17} /></span>
            <div className="min-w-0 flex-1 space-y-0.5 pt-1">
              <ToastPrimitive.Title className="text-sm font-semibold leading-snug text-foreground">
                {t.title}
              </ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="text-[13px] leading-snug text-muted-foreground">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            {t.action && (
              <ToastPrimitive.Action altText={t.action.label} asChild>
                <button
                  type="button"
                  onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                  className="shrink-0 self-center rounded-lg px-3 py-2 text-[13px] font-semibold text-primary-dark transition-colors hover:bg-primary/10 dark:text-primary-light"
                >
                  {t.action.label}
                </button>
              </ToastPrimitive.Action>
            )}
            <ToastPrimitive.Close aria-label="Fechar notificação" className="shrink-0 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X size={14} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="fixed bottom-[calc(4rem+var(--sab))] right-0 z-[100] flex max-h-screen w-full flex-col gap-2.5 overflow-hidden p-4 outline-none sm:max-w-sm sm:p-6 lg:bottom-0" />
    </ToastPrimitive.Provider>
  )
}
