import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogIcon } from '@/components/ui/Dialog'
import { PlatformPicker } from '@/components/planner/PlatformPicker'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface GenerateMonthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: { id: string; name: string }[]
  /** Preselected client (e.g. the active filter). Falls back to the first client. */
  defaultClientId?: string
  onGenerated?: () => void
}

/** Brand Brain plans a whole month (topics, hooks, formats) and creates the drafts. */
export function GenerateMonthDialog({ open, onOpenChange, clients, defaultClientId, onGenerated }: GenerateMonthDialogProps) {
  const now = new Date()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    clientId: '',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    postsCount: 12,
    reelsCount: 4,
    storiesCount: 8,
    objectives: 'Engajamento e crescimento de seguidores',
    platforms: ['INSTAGRAM'] as string[],
  })

  useEffect(() => {
    if (!open) return
    setForm((prev) => ({ ...prev, clientId: defaultClientId || prev.clientId || clients[0]?.id || '' }))
  }, [open, defaultClientId, clients])

  const years = [now.getFullYear(), now.getFullYear() + 1]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clientId) return
    setLoading(true)
    try {
      const { data } = await api.post('/ai/generate-calendar', form)
      const calendar = await api.post('/calendars', {
        clientId: form.clientId,
        name: `Calendário Brand Brain · ${form.month}/${form.year}`,
        month: form.month,
        year: form.year,
      })

      for (const item of data.contents || []) {
        await api.post('/contents', {
          clientId: form.clientId,
          calendarId: calendar.data.id,
          title: item.title,
          contentType: item.type || 'IMAGE',
          objective: item.objective,
          brief: item.brief,
          hook: item.hook,
          caption: item.captionDraft,
          cta: item.cta,
          scheduledAt: item.date ? new Date(item.date) : null,
          platforms: form.platforms.length ? form.platforms : ['INSTAGRAM'],
        })
      }

      onOpenChange(false)
      onGenerated?.()
      toast.success('Mês gerado pelo Brand Brain', `${(data.contents || []).length} conteúdos criados como rascunho.`)
    } catch (err) {
      toast.error('Erro ao gerar o mês', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const count = (key: 'postsCount' | 'reelsCount' | 'storiesCount', label: string) => (
    <div>
      <Label htmlFor={`gen-${key}`}>{label}</Label>
      <Input
        id={`gen-${key}`}
        type="number"
        min={0}
        max={60}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: Math.max(0, Number(e.target.value)) })}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(value) => !loading && onOpenChange(value)}>
      <DialogContent size="lg">
        <DialogHeader icon={<DialogIcon className="border-transparent bg-primary"><Sparkles size={22} className="text-[#fff]" /></DialogIcon>}>
              <DialogTitle>Gerar mês com Brand Brain</DialogTitle>
              <DialogDescription>Temas, hooks e formatos alinhados à marca, criados como rascunho.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="gen-client">Cliente / marca *</Label>
            <Select required value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
              <SelectTrigger id="gen-client"><SelectValue placeholder="Escolha um cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gen-month">Mês</Label>
              <Select value={String(form.month)} onValueChange={(v) => setForm({ ...form, month: Number(v) })}>
                <SelectTrigger id="gen-month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="gen-year">Ano</Label>
              <Select value={String(form.year)} onValueChange={(v) => setForm({ ...form, year: Number(v) })}>
                <SelectTrigger id="gen-year"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {count('postsCount', 'Posts')}
            {count('reelsCount', 'Reels')}
            {count('storiesCount', 'Stories')}
          </div>

          <div>
            <Label>Redes sociais *</Label>
            <PlatformPicker value={form.platforms} onChange={(platforms) => setForm({ ...form, platforms })} />
          </div>

          <div>
            <Label htmlFor="gen-objectives">Objetivo principal do mês</Label>
            <Textarea
              id="gen-objectives"
              rows={2}
              value={form.objectives}
              onChange={(e) => setForm({ ...form, objectives: e.target.value })}
              placeholder="Ex: lançamento de nova coleção, gerar leads, engajar comunidade…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" loading={loading} disabled={!form.clientId}>
              {loading ? <span>Planejando…</span> : <><Sparkles size={16} /><span>Gerar mês completo</span></>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
