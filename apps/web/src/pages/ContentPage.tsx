import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DndContext, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Plus, Sparkles, ChevronRight, ChevronLeft, AlertCircle, Settings2, FilePlus2 } from 'lucide-react'
import api from '@/lib/api'
import { PLATFORM_LABELS, STATUS_LABELS, cn } from '@/lib/utils'
import { PageFab } from '@/components/layout/PageFab'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateTimeField } from '@/components/ui/DateTimeField'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Skeleton } from '@/components/ui/Skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogTitle, DialogFooter, DialogHeader, DialogDescription, DialogIcon } from '@/components/ui/Dialog'
import { CalendarMonthView } from '@/components/planner/CalendarMonthView'
import { BoardView } from '@/components/planner/BoardView'
import { BoardColumnsModal } from '@/components/planner/BoardColumnsModal'
import { PlatformIcon } from '@/components/planner/PlatformIcon'
import { PlatformPicker } from '@/components/planner/PlatformPicker'
import { ContentLibrary } from '@/components/content/ContentLibrary'
import { GenerateMonthDialog } from '@/components/planner/GenerateMonthDialog'
import { Page, PageHeader } from '@/components/layout/Page'
import { FilterMenu, FilterField } from '@/components/ui/FilterMenu'
import {
  getMonthGridRange, dateKey, capitalize, parseKanbanColumns, getBoardColumns, getVisibleBoardColumns,
  type KanbanColumnConfig,
} from '@/components/planner/plannerUtils'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'

const ALL_CLIENTS = 'ALL'
const ALL_STATUS = 'ALL'
const ALL_PLATFORMS = 'ALL'
const LIST_DISPLAY_KEY = 'agencyos-content-list-display'
const FILTER_STATUSES = ['IDEA', 'DRAFT', 'IN_PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED']

type ListDisplay = 'rows' | 'grid'

export type ViewMode = 'list' | 'calendar' | 'board'

const VIEW_LABELS: Record<ViewMode, string> = {
  list: 'Conteúdos',
  calendar: 'Planner',
  board: 'Kanban',
}

const VIEW_DESCRIPTIONS: Record<ViewMode, string> = {
  list: 'Organize, encontre e reveja as imagens, os vídeos e os carrosséis da agência.',
  calendar: 'Visão mensal — arraste um card para reagendar.',
  board: 'Fluxo de produção em Kanban — arraste entre colunas para mudar o status.',
}

interface ContentPageProps {
  view: ViewMode
}

export function ContentPage({ view }: ContentPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const entry = location.state as { create?: boolean; clientId?: string; status?: string } | null
  const [currentDate, setCurrentDate] = useState(new Date())
  const [contents, setContents] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState(entry?.clientId || '')
  const [selectedStatus, setSelectedStatus] = useState(entry?.status && FILTER_STATUSES.includes(entry.status) ? entry.status : '')
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [listDisplay, setListDisplay] = useState<ListDisplay>(
    () => { try { return localStorage.getItem(LIST_DISPLAY_KEY) === 'grid' ? 'grid' : 'rows' } catch { return 'rows' } }
  )
  const contentRequest = useRef<AbortController | null>(null)
  const [agency, setAgency] = useState<any>(null)
  const [showColumnsModal, setShowColumnsModal] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)

  // New Content Modal
  const [showModal, setShowModal] = useState(entry?.create === true)
  const [newContent, setNewContent] = useState({
    clientId: entry?.clientId || '',
    title: '',
    contentType: 'IMAGE',
    brief: '',
    scheduledAt: '',
    platforms: ['INSTAGRAM'] as string[],
  })

  // Consume dashboard shortcuts once. Reuse the existing form and filters without new routes.
  useEffect(() => {
    if (!entry) return
    if (entry.clientId) setSelectedClient(entry.clientId)
    if (entry.status && FILTER_STATUSES.includes(entry.status)) setSelectedStatus(entry.status)
    if (entry.create) setShowModal(true)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.key])

  const sensors = useSensors(
    // Mouse: drag after 8px. Touch: long-press (250ms) so a normal swipe still scrolls the page.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  )

  const kanbanOverrides = useMemo(() => parseKanbanColumns(agency?.kanbanColumns), [agency])
  const boardColumns = useMemo(() => getVisibleBoardColumns(kanbanOverrides), [kanbanOverrides])

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

  useEffect(() => {
    if (view !== 'board' || agency) return
    api.get('/agencies/current').then(({ data }) => setAgency(data)).catch((err) => console.error(err))
  }, [view, agency])

  const handleSaveColumns = async (overrides: KanbanColumnConfig[]) => {
    try {
      const { data } = await api.patch('/agencies/current', { kanbanColumns: overrides })
      setAgency(data)
      setShowColumnsModal(false)
      toast.success('Colunas do quadro atualizadas.')
    } catch (err) {
      toast.error('Erro ao salvar colunas', getErrorMessage(err))
    }
  }

  const loadContents = async () => {
    contentRequest.current?.abort()
    const request = new AbortController()
    contentRequest.current = request
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
      if (view === 'list') {
        // Existing pagination: search and ordering must cover the complete filtered library.
        const library: any[] = []
        let page = 1
        while (true) {
          const { data } = await api.get('/contents', { params: { ...params, page, limit: 100 }, signal: request.signal })
          library.push(...(data.data || []))
          if (!data.data?.length || library.length >= data.total) break
          page++
        }
        if (!request.signal.aborted) setContents(library)
      } else {
        const { data } = await api.get('/contents', { params, signal: request.signal })
        if (!request.signal.aborted) setContents(data.data || [])
      }
    } catch (err) {
      if (!request.signal.aborted) setError('Não foi possível consultar os conteúdos. Verifique a conexão e tente novamente.')
    } finally {
      if (!request.signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    loadContents()
    return () => contentRequest.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, selectedStatus, selectedPlatform, view, currentDate])

  const changeListDisplay = (mode: ListDisplay) => {
    setListDisplay(mode)
    try { localStorage.setItem(LIST_DISPLAY_KEY, mode) } catch { /* Keep the in-session preference if storage is unavailable. */ }
  }

  const openCreateModal = (date?: Date) => {
    // Only a real Date pre-fills the schedule (a click event passed by mistake is ignored).
    const day = date instanceof Date && !Number.isNaN(date.getTime()) ? date : undefined
    setNewContent((prev) => ({ ...prev, scheduledAt: day ? `${dateKey(day)}T09:00` : '' }))
    setShowModal(true)
  }

  // Deep links (and the old mobile "+") land here with ?novo=1 — open the create modal once.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('novo') !== '1') return
    openCreateModal()
    const next = new URLSearchParams(searchParams)
    next.delete('novo')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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
      navigate(`/app/content/${data.id}`)
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

  // Shared by drag & drop and the card's "Mover para…" menu.
  const moveToStatus = async (content: any, newStatus: string) => {
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
      await moveToStatus(content, overId.slice(7))
    }
  }

  const goPrev = () => setCurrentDate((d) => subMonths(d, 1))
  const goNext = () => setCurrentDate((d) => addMonths(d, 1))
  const goToday = () => setCurrentDate(new Date())

  const filtersMenu = (
<FilterMenu
      active={[selectedClient, selectedStatus, selectedPlatform].filter(Boolean).length}
      onClear={() => { setSelectedClient(''); setSelectedStatus(''); setSelectedPlatform('') }}
    >
      <FilterField label="Cliente">
        <Select value={selectedClient || ALL_CLIENTS} onValueChange={(v) => setSelectedClient(v === ALL_CLIENTS ? '' : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLIENTS}>Todos os clientes</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Status">
        <Select value={selectedStatus || ALL_STATUS} onValueChange={(v) => setSelectedStatus(v === ALL_STATUS ? '' : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS}>Todos os status</SelectItem>
            {FILTER_STATUSES.map((status) => <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Rede social">
        <Select value={selectedPlatform || ALL_PLATFORMS} onValueChange={(v) => setSelectedPlatform(v === ALL_PLATFORMS ? '' : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PLATFORMS}>Todas as redes</SelectItem>
            {Object.keys(PLATFORM_LABELS).map((p) => <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
    </FilterMenu>
  )

  const dateLabel = capitalize(format(currentDate, 'MMMM yyyy', { locale: ptBR }))

  return (
    <Page>
      <PageHeader
        title={VIEW_LABELS[view]}
        description={VIEW_DESCRIPTIONS[view]}
        actions={
          <>
            <Button variant="outline" aria-label="Gerar mês com Brand Brain" onClick={() => setShowGenerateModal(true)} disabled={clients.length === 0}>
              <Sparkles size={16} />
              <span className="sm:hidden">Gerar mês</span><span className="hidden sm:inline">Gerar mês com Brand Brain</span>
            </Button>
            <Button onClick={() => openCreateModal()} className="hidden lg:inline-flex"><Plus size={16} />Novo conteúdo</Button>
            {/* Planner on phones: filters live in the header instead of a row of their own */}
            {view === 'calendar' && <div className="md:hidden">{filtersMenu}</div>}
          </>
        }
      />

      <PageFab label="Novo conteúdo" onClick={() => openCreateModal()} />

      {/* Planner / Kanban toolbar: period (Planner) or columns (Kanban) on the left, filters on the right */}
      {view !== 'list' && (
        <div className={cn('flex-wrap items-center gap-2.5', view === 'calendar' ? 'hidden md:flex' : 'flex')}>
          {view === 'calendar' && (
            <div className="hidden items-center gap-1 md:flex">
              <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Mês anterior"><ChevronLeft size={18} /></Button>
              <span className="min-w-[140px] text-center text-base font-semibold text-foreground">{dateLabel}</span>
              <Button variant="ghost" size="icon" onClick={goNext} aria-label="Próximo mês"><ChevronRight size={18} /></Button>
              <Button variant="outline" size="sm" onClick={goToday} className="ml-1">Hoje</Button>
            </div>
          )}
          {view === 'board' && (
            <Button variant="outline" size="sm" onClick={() => setShowColumnsModal(true)} className="gap-1.5">
              <Settings2 size={14} />
              <span>Colunas</span>
            </Button>
          )}
          <div className="ml-auto">
            {filtersMenu}
          </div>
        </div>
      )}

      {error && view !== 'list' && (
        <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error-dark text-xs flex items-center gap-2 font-semibold">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* The library uses the same content records and existing actions. */}
      {view === 'list' ? (
        <ContentLibrary contents={contents} clients={clients} loading={loading} error={error}
          mode={listDisplay} onModeChange={changeListDisplay}
          client={selectedClient} status={selectedStatus} platform={selectedPlatform} statuses={FILTER_STATUSES}
          onClientChange={setSelectedClient} onStatusChange={setSelectedStatus} onPlatformChange={setSelectedPlatform}
          onRetry={() => void loadContents()} onCreate={() => openCreateModal()}
          onDelete={(id, title) => void handleDeleteContent(id, title)} />
      ) : loading && contents.length === 0 ? <Skeleton className="h-[520px] w-full rounded-2xl" /> : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {view === 'calendar' && (
            <CalendarMonthView
              currentDate={currentDate}
              contents={contents}
              onOpenContent={(id) => navigate(`/app/content/${id}`)}
              onCreateAt={openCreateModal}
              onNavigateMonth={setCurrentDate}
            />
          )}

          {view === 'board' && (
            <BoardView contents={contents} columns={boardColumns} onOpenContent={(id) => navigate(`/app/content/${id}`)} onCreate={() => openCreateModal()} onMove={(content, status) => void moveToStatus(content, status)} />
          )}
        </DndContext>
      )}

      <BoardColumnsModal
        open={showColumnsModal}
        onOpenChange={setShowColumnsModal}
        initialColumns={getBoardColumns(kanbanOverrides)}
        onSave={handleSaveColumns}
      />

      {/* New Content Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader icon={<DialogIcon><FilePlus2 /></DialogIcon>}>
            <DialogTitle>Novo conteúdo</DialogTitle>
            <DialogDescription>Defina o básico agora — o restante você completa no Workspace.</DialogDescription>
          </DialogHeader>

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
              <Label htmlFor="newContentTitle">Título do post *</Label>
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
                  <SelectItem value="IMAGE">Imagem estática</SelectItem>
                  <SelectItem value="CAROUSEL">Carrossel</SelectItem>
                  <SelectItem value="REEL">Reel / vídeo curto</SelectItem>
                  <SelectItem value="STORY">Story</SelectItem>
                  <SelectItem value="VIDEO">Vídeo longo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Redes sociais *</Label>
              <PlatformPicker
                value={newContent.platforms}
                onChange={(platforms) => setNewContent({ ...newContent, platforms })}
              />
            </div>

            <div>
              <Label htmlFor="newContentScheduledAt">Data e hora agendada (opcional)</Label>
              <DateTimeField
                id="newContentScheduledAt"
                value={newContent.scheduledAt}
                onChange={(v) => setNewContent({ ...newContent, scheduledAt: v })}
              />
            </div>

            <div>
              <Label htmlFor="newContentBrief">Briefing inicial (opcional)</Label>
              <Textarea
                id="newContentBrief"
                rows={2}
                placeholder="Ideia central ou objetivo do post…"
                value={newContent.brief}
                onChange={(e) => setNewContent({ ...newContent, brief: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Abrir Workspace</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <GenerateMonthDialog
        open={showGenerateModal}
        onOpenChange={setShowGenerateModal}
        clients={clients}
        defaultClientId={selectedClient || undefined}
        onGenerated={loadContents}
      />
    </Page>
  )
}
