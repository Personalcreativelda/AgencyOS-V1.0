import { useEffect, useState, type ReactNode } from 'react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogIcon, DialogTitle } from '@/components/ui/Dialog'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'

export interface CredentialField {
  /** Key sent to the API on save. */
  name: string
  label: string
  placeholder?: string
  secret?: boolean
  /** Key in the GET response holding the current (masked) value. */
  current?: string
  help?: string
}

/**
 * One "agency credential" row (icon, title, status, Configurar/Editar/Remover) plus its modal.
 * Talks to a GET/PUT/DELETE `endpoint` that answers `{ configured, ...fields }`, so every
 * integration the agency configures itself in the dashboard behaves the same way.
 */
export function CredentialSettingsRow({
  endpoint, title, icon, iconClassName, iconStyle, emptyHint, summary, fields, dialogDescription, notice, onChange,
}: {
  endpoint: string
  title: string
  icon: ReactNode
  iconClassName?: string
  iconStyle?: React.CSSProperties
  emptyHint: string
  /** Line shown under the title once configured. */
  summary: (data: any) => string
  fields: CredentialField[]
  dialogDescription: ReactNode
  notice?: ReactNode
  onChange?: (configured: boolean) => void
}) {
  const [data, setData] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [reveal, setReveal] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get(endpoint).then(({ data }) => { setData(data); onChange?.(!!data?.configured) }).catch(() => setData({ configured: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  const configured = !!data?.configured
  const openModal = () => {
    // Prefill non-secret values so editing doesn't mean retyping everything.
    setValues(Object.fromEntries(fields.map((f) => [f.name, !f.secret && f.current && data?.[f.current] ? String(data[f.current]) : ''])))
    setReveal({})
    setOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: next } = await api.put(endpoint, values)
      setData(next)
      onChange?.(true)
      setOpen(false)
      toast.success(`${title} configurado.`)
    } catch (err) {
      toast.error(`Não foi possível salvar ${title}`, getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const ok = await confirmDialog({
      title: `Remover ${title}?`,
      description: 'As funções que dependem desta credencial deixam de funcionar até ela ser configurada de novo.',
      variant: 'destructive',
      confirmLabel: 'Remover',
    })
    if (!ok) return
    try {
      const { data: next } = await api.delete(endpoint)
      setData(next)
      onChange?.(false)
    } catch (err) {
      toast.error(`Erro ao remover ${title}`, getErrorMessage(err))
    }
  }

  const complete = fields.every((f) => (values[f.name] || '').trim())

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5 sm:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className={iconClassName || 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/80'} style={iconStyle}>{icon}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{configured ? summary(data) : emptyHint}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {data === null ? null : configured ? <Badge variant="success" className="hidden sm:inline-flex">Configurado</Badge> : <Badge variant="default" className="hidden sm:inline-flex">Não configurado</Badge>}
          <Button type="button" variant="outline" size="sm" onClick={openModal}>{configured ? 'Editar' : 'Configurar'}</Button>
          {configured && (
            <button type="button" onClick={remove} title="Remover" aria-label={`Remover ${title}`} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-error">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader icon={<DialogIcon className={iconClassName} style={iconStyle}>{icon}</DialogIcon>}>
            <DialogTitle>{configured ? `Editar ${title}` : `Configurar ${title}`}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4" autoComplete="off">
            {notice}
            {fields.map((f) => (
              <div key={f.name}>
                <Label htmlFor={`cred-${f.name}`}>{f.label}</Label>
                <Input
                  id={`cred-${f.name}`}
                  name={`cred_${f.name}`}
                  autoComplete={f.secret ? 'new-password' : 'off'}
                  type={f.secret && !reveal[f.name] ? 'password' : 'text'}
                  placeholder={f.secret && configured && f.current && data?.[f.current] ? `Atual: ${data[f.current]}` : f.placeholder}
                  value={values[f.name] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  endAdornment={f.secret ? (
                    <button type="button" onClick={() => setReveal((r) => ({ ...r, [f.name]: !r[f.name] }))} className="p-1 text-muted-foreground hover:text-foreground" aria-label={reveal[f.name] ? 'Ocultar' : 'Mostrar'}>
                      {reveal[f.name] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  ) : undefined}
                />
                {f.help && <p className="mt-1.5 text-xs text-muted-foreground">{f.help}</p>}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={!complete} loading={saving}>{!saving && 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
