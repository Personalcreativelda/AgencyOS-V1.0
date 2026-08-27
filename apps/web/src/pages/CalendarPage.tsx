import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar as CalendarIcon, Sparkles, Eye
} from 'lucide-react'
import api from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CONTENT_TYPE_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'

const ALL_CLIENTS = 'ALL'

export function CalendarPage() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [contents, setContents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // AI Calendar Modal
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiForm, setAiForm] = useState({
    clientId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    postsCount: 12,
    reelsCount: 4,
    storiesCount: 8,
    objectives: 'Engajamento e crescimento de seguidores',
  })

  useEffect(() => {
    async function loadClients() {
      try {
        const { data } = await api.get('/clients')
        setClients(data.data || [])
        if (data.data?.length > 0 && !selectedClient) {
          setSelectedClient(data.data[0].id)
          setAiForm((prev) => ({ ...prev, clientId: data.data[0].id }))
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadClients()
  }, [])

  const loadContents = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/contents', {
        params: { clientId: selectedClient || undefined },
      })
      setContents(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContents()
  }, [selectedClient])

  const handleGenerateAiCalendar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiForm.clientId) return
    setAiLoading(true)
    try {
      const { data } = await api.post('/ai/generate-calendar', aiForm)

      const calRes = await api.post('/calendars', {
        clientId: aiForm.clientId,
        name: `Calendário IA — ${aiForm.month}/${aiForm.year}`,
        month: aiForm.month,
        year: aiForm.year,
      })

      for (const item of data.contents || []) {
        await api.post('/contents', {
          clientId: aiForm.clientId,
          calendarId: calRes.data.id,
          title: item.title,
          contentType: item.type || 'IMAGE',
          objective: item.objective,
          brief: item.brief,
          hook: item.hook,
          caption: item.captionDraft,
          cta: item.cta,
          scheduledAt: item.date ? new Date(item.date) : null,
          platforms: ['INSTAGRAM', 'FACEBOOK'],
        })
      }

      setShowAiModal(false)
      loadContents()
      alert('🎉 Calendário gerado com sucesso pela IA!')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao gerar calendário.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Calendário Editorial</h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Planejamento, datas de publicação e agendamento de posts da agência.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-52">
            <Select
              value={selectedClient || ALL_CLIENTS}
              onValueChange={(v) => setSelectedClient(v === ALL_CLIENTS ? '' : v)}
            >
              <SelectTrigger className="shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CLIENTS}>Todos os Clientes</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setShowAiModal(true)}>
            <Sparkles size={16} />
            <span>Gerar Mês com IA</span>
          </Button>
        </div>
      </div>

      {/* Contents Calendar List / Cards */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : contents.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="Nenhum conteúdo agendado"
          description="Use o botão acima para a IA planejar os posts, hooks e datas do mês automaticamente."
        />
      ) : (
        <div className="space-y-3.5">
          {contents.map((item) => (
            <div
              key={item.id}
              className="card-minimals-hover p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary-dark flex flex-col items-center justify-center font-extrabold shrink-0 border border-primary/20">
                  <span className="text-[11px] uppercase font-bold tracking-wider">
                    {item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString('pt-BR', { month: 'short' }) : 'S/D'}
                  </span>
                  <span className="text-base leading-none mt-0.5">
                    {item.scheduledAt ? new Date(item.scheduledAt).getDate() : '--'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">
                      {item.client?.name}
                    </span>
                    <span className="text-xs text-muted-foreground/60">•</span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {CONTENT_TYPE_LABELS[item.contentType] || item.contentType}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-foreground line-clamp-1">{item.title}</h3>
                  {item.hook && <p className="text-xs text-muted-foreground font-medium line-clamp-1">"{item.hook}"</p>}
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <StatusBadge status={item.status} />

                <Button asChild variant="subtle" className="gap-1.5">
                  <Link to={`/app/content/${item.id}`}>
                    <Eye size={14} />
                    <span>Workspace</span>
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Calendar Generation Modal */}
      <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shrink-0">
                <Sparkles size={22} className="text-[#fff]" />
              </div>
              <div>
                <DialogTitle>Gerar Calendário Mensal com IA</DialogTitle>
                <DialogDescription>A IA planejará temas, hooks e formatos alinhados ao Brand Brain</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleGenerateAiCalendar} className="space-y-4">
            <div>
              <Label htmlFor="aiClientId">Cliente / Marca *</Label>
              <Select required value={aiForm.clientId} onValueChange={(v) => setAiForm({ ...aiForm, clientId: v })}>
                <SelectTrigger id="aiClientId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="normal-case tracking-normal font-bold text-grey-600 mb-1">Posts (Feed)</Label>
                <Input
                  type="number"
                  value={aiForm.postsCount}
                  onChange={(e) => setAiForm({ ...aiForm, postsCount: Number(e.target.value) })}
                  className="px-3 py-2"
                />
              </div>
              <div>
                <Label className="normal-case tracking-normal font-bold text-grey-600 mb-1">Reels</Label>
                <Input
                  type="number"
                  value={aiForm.reelsCount}
                  onChange={(e) => setAiForm({ ...aiForm, reelsCount: Number(e.target.value) })}
                  className="px-3 py-2"
                />
              </div>
              <div>
                <Label className="normal-case tracking-normal font-bold text-grey-600 mb-1">Stories</Label>
                <Input
                  type="number"
                  value={aiForm.storiesCount}
                  onChange={(e) => setAiForm({ ...aiForm, storiesCount: Number(e.target.value) })}
                  className="px-3 py-2"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="objectives">Objetivo Principal do Mês</Label>
              <Textarea
                id="objectives"
                rows={2}
                value={aiForm.objectives}
                onChange={(e) => setAiForm({ ...aiForm, objectives: e.target.value })}
                placeholder="Ex: Lançamento de nova coleção, gerar leads, engajar comunidade..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAiModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={aiLoading}>
                {!aiLoading && (
                  <>
                    <Sparkles size={16} />
                    <span>Gerar Mês Completo</span>
                  </>
                )}
                {aiLoading && <span>Planejando...</span>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
