import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Plus, FileText, ChevronRight, ChevronLeft, AlertCircle, List, LayoutGrid, Trash2,
} from 'lucide-react'
import api from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn, CONTENT_TYPE_LABELS, PLATFORM_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { CalendarMonthView } from '@/components/planner/CalendarMonthView'
import { BoardView } from '@/components/planner/BoardView'
import { PlatformIcon } from '@/components/planner/PlatformIcon'
import { PlatformPicker } from '@/components/planner/PlatformPicker'
import { ContentGridTile } from '@/components/planner/ContentGridTile'
import { getPrimaryImage, getMonthGridRange, dateKey, capitalize } from '@/components/planner/plannerUtils'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'

const ALL_CLIENTS = 'ALL'
const ALL_STATUS = 'ALL'
const ALL_PLATFORMS = 'ALL'
const LIST_DISPLAY_KEY = 'agencyos-content-list-display'

type ListDisplay = 'rows' | 'grid'

export type ViewMode = 'list' | 'calendar' | 'board'

const VIEW_LABELS: Record<ViewMode, string> = {
  list: 'Criativos',
  calendar: 'Planner',
  board: 'Kanban',
}

const VIEW_DESCRIPTIONS: Record<ViewMode, string> = {
  list: 'Todos os conteúdos em formato de lista, com thumbnail, cliente e status.',
  calendar: 'Visão mensal — arraste um card para reagendar.',
  board: 'Fluxo de produção em Kanban — arraste entre colunas para mudar o status.',
}

interface ContentPageProps {
  view: ViewMode
}

export function ContentPage({ view }: ContentPageProps) {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [contents, setContents] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [listDisplay, setListDisplay] = useState<ListDisplay>(
    () => (localStorage.getItem(LIST_DISPLAY_KEY) as ListDisplay) || 'rows'
  )

  // New Content Modal
  const [showModal, setShowModal] = useState(false)
  const [newContent, setNewContent] = useState({
    clientId: '',
    title: '',
    contentType: 'IMAGE',
    brief: '',
    scheduledAt: '',
    platforms: ['INSTAGRAM'] as string[],
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    async function loadClients() {
      try {
        const { data } = await api.get('/clients')
        setClients(data.data || [])
        if (data.data?.length > 0 && !newContent.clientId) {
          setNewContent((prev) => ({ ...prev, clientId: data.data[0].id }))
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadClients()
  }, [])

  const loadContents = async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, any> = {
        clientId: selectedClient || undefined,
        status: selectedStatus || undefined,
        platform: selectedPlatform || undefined,
      }
      if (view === 'calendar') {
        const { gridStart, gridEnd } = getMonthGridRange(currentDate)
        params.from = gridStart.toISOString()
        params.to = gridEnd.toISOString()
        params.limit = 500
      } else if (view === 'board') {
        params.limit = 300
      }
      const { data } = await api.get('/contents', { params })
      setContents(data.data || [])
    } catch (err) {
      console.error(err)
      setError('Erro ao carregar conteúdos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, selectedStatus, selectedPlatform, view, currentDate])

  const changeListDisplay = (mode: ListDisplay) => {
    setListDisplay(mode)
    localStorage.setItem(LIST_DISPLAY_KEY, mode)
  }

  const openCreateModal = (date?: Date) => {
    setNewContent((prev) => ({ ...prev, scheduledAt: date ? `${dateKey(date)}T09:00` : '' }))
    setShowModal(true)
  }

  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.clientId || !newContent.title) return
    try {
      const { data } = await api.post('/contents', {
        clientId: newContent.clientId,
        title: newContent.title,
        contentType: newContent.contentType,
        brief: newContent.brief,
        scheduledAt: newContent.scheduledAt ? new Date(newContent.scheduledAt).toISOString() : undefined,
        platforms: newContent.platforms.length ? newContent.platforms : ['INSTAGRAM'],
      })
      setShowModal(false)
      window.location.href = `/app/content/${data.id}`
    } catch (err) {
      toast.error('Erro ao criar conteúdo', getErrorMessage(err))
    }
  }

  const handleDeleteContent = async (contentId: string, title: string) => {
    const ok = await confirmDialog({
      title: 'Excluir conteúdo?',
      description: `"${title}" será removido do calendário e da lista de criativos. Essa ação não pode ser desfeita.`,
      variant: 'destructive',
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    const prevContents = contents
    setContents((cs) => cs.filter((c) => c.id !== contentId))
    try {
      await api.delete(`/contents/${contentId}`)
      toast.success('Conteúdo excluído.')
    } catch (err) {
      setContents(prevContents)
      toast.error('Erro ao excluir conteúdo', getErrorMessage(err))
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const content = active.data.current?.content
    if (!content) return
    const overId = String(over.id)

    if (overId.startsWith('day:')) {
      const newKey = overId.slice(4)
      const oldKey = content.scheduledAt ? dateKey(new Date(content.scheduledAt)) : null
      if (newKey === oldKey) return
      if (content.status === 'SCHEDULED') {
        const label = new Date(`${newKey}T00:00:00`).toLocaleDateString('pt-BR')
        const ok = await confirmDialog({
          title: 'Reagendar publicação?',
          description: `"${content.title}" já está agendado. Reagendar publicação para ${label}?`,
        })
        if (!ok) return
      }
      const prevTime = content.scheduledAt ? new Date(content.scheduledAt) : null
      const newDate = new Date(`${newKey}T00:00:00`)
      if (prevTime) newDate.setHours(prevTime.getHours(), prevTime.getMinutes())
      else newDate.setHours(9, 0)

      const prevContents = contents
      setContents((cs) => cs.map((c) => (c.id === content.id ? { ...c, scheduledAt: newDate.toISOString() } : c)))
      try {
        await api.patch(`/contents/${content.id}`, { scheduledAt: newDate.toISOString() })
      } catch (err) {
        setContents(prevContents)
        toast.error('Erro ao reagendar conteúdo', getErrorMessage(err))
      }
    } else if (overId.startsWith('status:')) {
      const newStatus = overId.slice(7)
      if (content.status === newStatus) return
      const prevContents = contents
      setContents((cs) => cs.map((c) => (c.id === content.id ? { ...c, status: newStatus } : c)))
      try {
        await api.post(`/contents/${content.id}/change-status`, { status: newStatus })
      } catch (err) {
        setContents(prevContents)
        toast.error('Erro ao alterar status', getErrorMessage(err))
      }
    }
  }

  const goPrev = () => setCurrentDate((d) => subMonths(d, 1))
  const goNext = () => setCurrentDate((d) => addMonths(d, 1))
  const goToday = () => setCurrentDate(new Date())

  const dateLabel = capitalize(format(currentDate, 'MMMM yyyy', { locale: ptBR }))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{VIEW_LABELS[view]}</h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            {VIEW_DESCRIPTIONS[view]}
          </p>
        </div>

        <Button onClick={() => openCreateModal()} className="self-start">
          <Plus size={16} />
          <span>Novo Conteúdo</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-end gap-3">
        {view === 'list' && (
          <div className="flex items-center gap-1 rounded-xl bg-muted p-1 self-start lg:self-auto lg:mr-auto">
            <button
              type="button"
              onClick={() => changeListDisplay('rows')}
              title="Lista"
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                listDisplay === 'rows' ? 'bg-card text-foreground shadow-z1' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => changeListDisplay('grid')}
              title="Grelha"
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                listDisplay === 'grid' ? 'bg-card text-foreground shadow-z1' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[140px] sm:w-44 sm:flex-none">
            <Select value={selectedClient || ALL_CLIENTS} onValueChange={(v) => setSelectedClient(v === ALL_CLIENTS ? '' : v)}>
              <SelectTrigger className="shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CLIENTS}>Todos os Clientes</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[140px] sm:w-44 sm:flex-none">
            <Select value={selectedStatus || ALL_STATUS} onValueChange={(v) => setSelectedStatus(v === ALL_STATUS ? '' : v)}>
              <SelectTrigger className="shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUS}>Todos os Estados</SelectItem>
                <SelectItem value="DRAFT">Rascunho</SelectItem>
                <SelectItem value="IN_PRODUCTION">Em Produção</SelectItem>
                <SelectItem value="CLIENT_REVIEW">Aguardando Cliente</SelectItem>
                <SelectItem value="CHANGES_REQUESTED">Alterações Solicitadas</SelectItem>
                <SelectItem value="APPROVED">Aprovado</SelectItem>
                <SelectItem value="SCHEDULED">Agendado</SelectItem>
                <SelectItem value="PUBLISHED">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[140px] sm:w-40 sm:flex-none">
            <Select value={selectedPlatform || ALL_PLATFORMS} onValueChange={(v) => setSelectedPlatform(v === ALL_PLATFORMS ? '' : v)}>
              <SelectTrigger className="shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PLATFORMS}>Todas as Redes</SelectItem>
                {Object.keys(PLATFORM_LABELS).map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Temporal navigation (Planner/Calendar) */}
      {view === 'calendar' && (
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="ghost" size="icon" onClick={goPrev}><ChevronLeft size={18} /></Button>
          <span className="text-sm font-bold text-foreground text-center">{dateLabel}</span>
          <Button variant="ghost" size="icon" onClick={goNext}><ChevronRight size={18} /></Button>
          <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error-dark text-xs flex items-center gap-2 font-semibold">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Views */}
      {loading ? (
        view === 'list' ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : (
          <Skeleton className="h-[520px] w-full rounded-2xl" />
        )
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {view === 'list' && (
            contents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nenhum conteúdo encontrado"
                description="Crie posts ou gere um calendário completo utilizando IA."
              />
            ) : listDisplay === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {contents.map((item) => (
                  <ContentGridTile
                    key={item.id}
                    content={item}
                    onClick={() => navigate(`/app/content/${item.id}`)}
                    onDelete={() => handleDeleteContent(item.id, item.title)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {contents.map((item) => {
                  const image = getPrimaryImage(item)
                  const time = item.scheduledAt
                    ? new Date(item.scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : null
                  return (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/app/content/${item.id}`)}
                      className="card-minimals-hover p-4 flex items-center justify-between gap-4 group cursor-pointer"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary-dark flex items-center justify-center font-bold shrink-0 border border-primary/20 overflow-hidden">
                          {image ? <img src={image.publicUrl} alt="" className="w-full h-full object-cover" /> : <FileText size={20} />}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-primary">{item.client?.name}</span>
                            <span className="text-xs text-muted-foreground/60">•</span>
                            <span className="text-xs text-muted-foreground font-medium">{CONTENT_TYPE_LABELS[item.contentType] || item.contentType}</span>
                            {(item.platforms || []).length > 0 && (
                              <span className="flex items-center gap-1">
                                {item.platforms.map((p: any) => <PlatformIcon key={p.id} platform={p.platform} size={12} />)}
                              </span>
                            )}
                            {time && (
                              <>
                                <span className="text-xs text-muted-foreground/60">•</span>
                                <span className="text-xs text-muted-foreground font-medium">{time}</span>
                              </>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {item.title}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <StatusBadge status={item.status} />
                        <button
                          type="button"
                          title="Excluir conteúdo"
                          onClick={(e) => { e.stopPropagation(); handleDeleteContent(item.id, item.title) }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-error hover:bg-error/10 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                        <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {view === 'calendar' && (
            <CalendarMonthView
              currentDate={currentDate}
              contents={contents}
              onOpenContent={(id) => navigate(`/app/content/${id}`)}
              onCreateAt={openCreateModal}
            />
          )}

          {view === 'board' && (
            <BoardView contents={contents} onOpenContent={(id) => navigate(`/app/content/${id}`)} />
          )}
        </DndContext>
      )}

      {/* New Content Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogTitle>Novo Conteúdo</DialogTitle>

          <form onSubmit={handleCreateContent} className="space-y-4">
            <div>
              <Label htmlFor="newContentClient">Cliente *</Label>
              <Select required value={newContent.clientId} onValueChange={(v) => setNewContent({ ...newContent, clientId: v })}>
                <SelectTrigger id="newContentClient">
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

            <div>
              <Label htmlFor="newContentTitle">Título do Post *</Label>
              <Input
                id="newContentTitle"
                type="text"
                required
                placeholder="Ex: Lançamento Coleção / Dica de Segunda"
                value={newContent.title}
                onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="newContentType">Formato *</Label>
              <Select value={newContent.contentType} onValueChange={(v) => setNewContent({ ...newContent, contentType: v })}>
                <SelectTrigger id="newContentType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMAGE">Imagem Estática</SelectItem>
                  <SelectItem value="CAROUSEL">Carrossel</SelectItem>
                  <SelectItem value="REEL">Reel / Vídeo Curto</SelectItem>
                  <SelectItem value="STORY">Story</SelectItem>
                  <SelectItem value="VIDEO">Vídeo Longo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Redes Sociais *</Label>
              <PlatformPicker
                value={newContent.platforms}
                onChange={(platforms) => setNewContent({ ...newContent, platforms })}
              />
            </div>

            <div>
              <Label htmlFor="newContentScheduledAt">Data e Hora Agendada (Opcional)</Label>
              <Input
                id="newContentScheduledAt"
                type="datetime-local"
                value={newContent.scheduledAt}
                onChange={(e) => setNewContent({ ...newContent, scheduledAt: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="newContentBrief">Briefing Inicial (Opcional)</Label>
              <Textarea
                id="newContentBrief"
                rows={2}
                placeholder="Ideia central ou objetivo do post..."
                value={newContent.brief}
                onChange={(e) => setNewContent({ ...newContent, brief: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Abrir Workspace</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
