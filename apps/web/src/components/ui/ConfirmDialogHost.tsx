import { AlertTriangle } from 'lucide-react'
import { useConfirmStore } from '@/lib/confirm'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './Dialog'
import { Button } from './Button'

/** Mounted once near the app root. Renders whatever confirmation is currently pending in
 *  `useConfirmStore`, in place of the browser's native `window.confirm()`. */
export function ConfirmDialogHost() {
  const request = useConfirmStore((s) => s.request)
  const close = useConfirmStore((s) => s.close)

  const settle = (value: boolean) => {
    request?.resolve(value)
    close()
  }

  return (
    <Dialog open={!!request} onOpenChange={(open) => { if (!open) settle(false) }}>
      <DialogContent className="max-w-sm" hideClose>
        {request && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                {request.variant === 'destructive' && (
                  <div className="w-10 h-10 rounded-2xl bg-error/10 text-error flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                )}
                <div>
                  <DialogTitle>{request.title}</DialogTitle>
                  {request.description && <DialogDescription>{request.description}</DialogDescription>}
                </div>
              </div>
            </DialogHeader>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => settle(false)}>
                {request.cancelLabel || 'Cancelar'}
              </Button>
              <Button
                type="button"
                variant={request.variant === 'destructive' ? 'destructive' : 'solid'}
                onClick={() => settle(true)}
              >
                {request.confirmLabel || 'Confirmar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
