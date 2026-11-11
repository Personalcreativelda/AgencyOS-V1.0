import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

/**
 * Three widths only, so every modal in the app lines up:
 *  - sm: confirmations, pickers, short single-field forms
 *  - md: standard forms (default)
 *  - lg: multi-section forms, wizards, previews
 */
const SIZES = {
  sm: 'sm:max-w-[420px]',
  md: 'sm:max-w-[520px]',
  lg: 'sm:max-w-[640px]',
} as const

export type DialogSize = keyof typeof SIZES

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean; size?: DialogSize }
>(({ className, children, hideClose, size = 'md', ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      data-motion="dialog"
      className="fixed inset-0 z-50 bg-[#000]/45 backdrop-blur-[2px] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out"
    />
    <DialogPrimitive.Content
      ref={ref}
      data-motion="dialog"
      className={cn(
        // Phones: bottom sheet that slides up from the edge.
        'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col gap-5 overflow-y-auto overscroll-contain rounded-t-2xl border-t border-border bg-card p-5 shadow-dialog focus:outline-none',
        'data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out',
        // Tablet/desktop: centred card with a short scale/fade.
        'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-6',
        'sm:data-[state=open]:animate-dialog-in sm:data-[state=closed]:animate-dialog-out',
        SIZES[size],
        className
      )}
      {...props}
    >
      <div aria-hidden className="mx-auto -mb-2 -mt-1 h-1 w-9 shrink-0 rounded-full bg-grey-300 sm:hidden" />
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:right-4 sm:top-4"
        >
          <X size={16} />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

/** Title block. Pass `icon` (usually a <DialogIcon>) to get the standard icon + text layout. */
export function DialogHeader({
  className, icon, children, ...props
}: React.HTMLAttributes<HTMLDivElement> & { icon?: React.ReactNode }) {
  if (icon) {
    return (
      <div className={cn('flex items-start gap-3.5 pr-8', className)} {...props}>
        <div className="shrink-0">{icon}</div>
        <div className="min-w-0 space-y-1 pt-0.5">{children}</div>
      </div>
    )
  }
  return <div className={cn('space-y-1 pr-8', className)} {...props}>{children}</div>
}

/** Standard 40px icon tile for dialog headers. Override colours via className for brand modals. */
export function DialogIcon({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('flex size-10 items-center justify-center rounded-xl border border-border bg-muted text-foreground/80 [&>svg]:size-[18px]', className)}
      {...props}
    />
  )
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-[17px] font-bold leading-snug tracking-tight text-foreground', className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-[13px] leading-relaxed text-muted-foreground', className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

/**
 * Action bar pinned to the bottom of the dialog while the body scrolls. On phones the buttons
 * stack full-width with the primary action on top (closest to the thumb is the last in DOM order).
 */
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'sticky -bottom-5 z-10 -mx-5 -mb-5 mt-1 flex flex-col-reverse gap-2 border-t border-border bg-card px-5 py-4 pb-[max(1rem,var(--sab))]',
        'sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-end sm:gap-2.5 sm:px-6 sm:pb-4',
        '[&>*]:w-full sm:[&>*]:w-auto',
        className
      )}
      {...props}
    />
  )
}
