import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { useConfirmStore, type ConfirmOptions } from '@/lib/confirm'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogIcon, DialogTitle, DialogDescription, DialogFooter } from './Dialog'
import { Button } from './Button'

/** Mounted once near the app root. Renders whatever confirmation is currently pending in
 *  `useConfirmStore`, in place of the browser's native `window.confirm()`. */
export function ConfirmDialogHost() {
  const request = useConfirmStore((s) => s.request)
  const settle = useConfirmStore((s) => s.settle)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Keep showing the last request's text while the exit animation plays (the store clears
  // `request` immediately on settle, which would otherwise blank the dialog mid-fade).
  const [shown, setShown] = useState<ConfirmOptions | null>(request)
  useEffect(() => { if (request) setShown(request) }, [request])

  const destructive = shown?.variant === 'destructive'

  return (
    <Dialog open={!!request} onOpenChange={(open) => { if (!open) settle(false) }}>
      <DialogContent
        size="sm"
        hideClose
        role="alertdialog"
        // Destructive: land on "Cancelar" so a reflexive Enter never deletes anything.
        // Neutral: land on the primary action so Enter confirms.
        onOpenAutoFocus={(e) => {
          if (!destructive) {
            e.preventDefault()
            confirmRef.current?.focus()
          }
        }}
      >
        {shown && (
          <>
            <DialogHeader
              icon={
                <DialogIcon className={cn(destructive && 'border-error/20 bg-error/10 text-error')}>
                  {destructive ? <AlertTriangle /> : <HelpCircle />}
                </DialogIcon>
              }
            >
              <DialogTitle>{shown.title}</DialogTitle>
              {shown.description && <DialogDescription>{shown.description}</DialogDescription>}
            </DialogHeader>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => settle(false)}>
                {shown.cancelLabel || 'Cancelar'}
              </Button>
              <Button
                ref={confirmRef}
                type="button"
                variant={destructive ? 'destructive' : 'solid'}
                onClick={() => settle(true)}
              >
                {shown.confirmLabel || 'Confirmar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
