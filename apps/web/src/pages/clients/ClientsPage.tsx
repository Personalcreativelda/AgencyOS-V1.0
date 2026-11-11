import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, Building2, User, ChevronRight, FileText, RefreshCw, AlertCircle, LayoutGrid, List } from 'lucide-react'
import api from '@/lib/api'
import { getInitials } from '@/lib/utils'
import { getErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Page, PageHeader } from '@/components/layout/Page'
import { FilterMenu, FilterField } from '@/components/ui/FilterMenu'
import { ViewToggle } from '@/components/ui/ViewToggle'

type Client = {
  id: string; name: string; industry?: string | null; description?: string | null
  logoUrl?: string | null; status: string; createdAt: string
  accountManager?: { id: string; name: string } | null
  _count?: { contents: number }
}
type ClientPage = { data: Client[]; total: number; page: number; limit: number }
const statusLabels: Record<string, string> = { ACTIVE: 'Ativo', PAUSED: 'Pausado', INACTIVE: 'Inativo', ARCHIVED: 'Arquivado', CHURNED: 'Encerrado' }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt')
const gridClass = 'grid auto-rows-fr grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3 lg:gap-5'
// Soft tinted tiles for clients without a logo (stable per name).
const INITIAL_TONES = [
  'bg-primary/10 text-primary-dark dark:text-primary-light',
  'bg-info/10 text-info-dark dark:text-info-light',
  'bg-secondary/10 text-secondary-dark dark:text-secondary-light',
  'bg-warning/15 text-warning-dark dark:text-warning-light',
  'bg-error/10 text-error-dark dark:text-error-light',
]
const toneFor = (name: string) => INITIAL_TONES[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % INITIAL_TONES.length]
const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'PAUSED', label: 'Pausados' },
]

function ClientLogo({ client, className = 'size-12' }: { client: Client; className?: string }) {
  return (
    <Avatar className={`${className} shrink-0 rounded-xl border border-border/70`}>
      {client.logoUrl && <AvatarImage src={client.logoUrl} alt="" className="object-contain" />}
      <AvatarFallback className={`rounded-none text-[15px] font-bold ${toneFor(client.name)}`}>{getInitials(client.name)}</AvatarFallback>
    </Avatar>
  )
}

function StatusText({ status }: { status: string }) {
  const tone = status === 'ACTIVE' ? 'text-success-dark dark:text-success' : status === 'PAUSED' ? 'text-warning-dark dark:text-warning' : 'text-muted-foreground'
  const dot = status === 'ACTIVE' ? 'bg-success' : status === 'PAUSED' ? 'bg-warning' : 'bg-muted-foreground/60'
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold ${tone}`}>
      <span aria-hidden className={`size-2 rounded-full ${dot}`} />{statusLabels[status] || status || 'Não informado'}
    </span>
  )
}

function ClientCard({ client, onDescription }: { client: Client; onDescription: (client: Client) => void }) {
  const description = useRef<HTMLParagraphElement>(null)
  const [truncated, setTruncated] = useState(false)
  const text = client.description?.trim()
  const contents = client._count?.contents ?? 0
  useEffect(() => {
    const element = description.current
    if (!element) return
    const observer = new ResizeObserver(() => setTruncated(element.scrollHeight > element.clientHeight + 1))
    observer.observe(element)
    return () => observer.disconnect()
  }, [text])
  return (
    <article className="group relative flex h-full min-h-[232px] min-w-0 flex-col gap-4 rounded-[20px] border border-border/70 bg-card p-5 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-grey-400 hover:shadow-card-hover focus-within:border-primary/60 motion-reduce:transition-none sm:p-6">
      <div className="flex items-start gap-3.5">
        <ClientLogo client={client} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-6 text-foreground">
            <Link to={`/app/clients/${client.id}`} aria-label={`Abrir cliente ${client.name}`} title={client.name}
              className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-primary focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background">
              {client.name}
            </Link>
          </h2>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground" title={client.industry || undefined}>{client.industry?.trim() || 'Setor não informado'}</p>
        </div>
        <span className="mt-0.5"><StatusText status={client.status} /></span>
      </div>
      <div className={text ? 'min-h-16' : 'hidden min-h-16 sm:block'}>
        <p ref={description} className={`line-clamp-2 break-words text-sm leading-relaxed ${text ? 'text-foreground/80' : 'text-muted-foreground'}`}>
          {text || 'Descrição não adicionada.'}
        </p>
        {truncated && <button type="button" onClick={() => onDescription(client)} aria-label={`Ler descrição completa de ${client.name}`}
          className="relative z-10 -ml-1 mt-0.5 min-h-6 rounded px-1 text-xs font-medium text-primary-dark underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-light motion-reduce:transition-none">Ver mais</button>}
      </div>
      <div className="mt-auto flex min-w-0 items-center gap-3 border-t border-border/70 pt-4 text-[13px] leading-5 text-muted-foreground">
        <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-foreground/80"><FileText size={14} aria-hidden /><span className="tabular-nums">{contents === 0 ? 'Sem conteúdos' : `${contents} ${contents === 1 ? 'conteúdo' : 'conteúdos'}`}</span></span>
        <span className="inline-flex min-w-0 items-center gap-1.5" title={client.accountManager?.name || 'Gestor não atribuído'}><User size={14} className="shrink-0" aria-hidden /><span className="truncate">{client.accountManager?.name || 'Sem gestor'}</span></span>
        <ChevronRight size={15} aria-hidden className="ml-auto shrink-0 transition-colors group-hover:text-foreground group-focus-within:text-foreground motion-reduce:transition-none" />
      </div>
    </article>
  )
}

function ClientRow({ client }: { client: Client }) {
  const contents = client._count?.contents ?? 0
  return (
    <li>
      <Link to={`/app/clients/${client.id}`} className="group flex min-w-0 items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-6">
        <ClientLogo client={client} className="size-11" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-foreground">{client.name}</span>
          <span className="block truncate text-[13px] text-muted-foreground">{client.industry?.trim() || 'Setor não informado'}</span>
        </span>
        <span className="hidden w-32 shrink-0 text-[13px] tabular-nums text-muted-foreground md:block">{contents === 0 ? 'Sem conteúdos' : `${contents} ${contents === 1 ? 'conteúdo' : 'conteúdos'}`}</span>
        <span className="hidden w-40 shrink-0 truncate text-[13px] text-muted-foreground lg:block">{client.accountManager?.name || 'Sem gestor'}</span>
        <span className="w-24 shrink-0 text-right"><StatusText status={client.status} /></span>
        <ChevronRight size={16} aria-hidden className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Link>
    </li>
  )
}

export function ClientsPage() {
  const agencyId = useAuthStore(state => state.user?.agency.id)
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') || ''
  const [status, setStatus] = useState('all')
  const [manager, setManager] = useState('all')
  const [sort, setSort] = useState('name-asc')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [view, setView] = useState<'grid' | 'list'>(() => (typeof localStorage !== 'undefined' && localStorage.getItem('agencyos-clients-view') === 'list' ? 'list' : 'grid'))
  const changeView = (next: 'grid' | 'list') => { setView(next); try { localStorage.setItem('agencyos-clients-view', next) } catch { /* private mode */ } }
  const query = useQuery({
    queryKey: ['clients', 'directory', agencyId],
    queryFn: async ({ signal }) => {
      // Existing pagination keeps local filters from silently covering only the first 20 clients.
      const clients: Client[] = []
      let page = 1
      while (true) {
        const { data } = await api.get<ClientPage>('/clients', { params: { page, limit: 100 }, signal })
        clients.push(...data.data)
        if (!data.data.length || clients.length >= data.total) return clients
        page++
      }
    },
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const clients = query.data || []
  const managers = useMemo(() => Array.from(new Map(clients.flatMap(client => client.accountManager ? [[client.accountManager.id, client.accountManager] as const] : [])).values()).sort((a, b) => a.name.localeCompare(b.name, 'pt')), [clients])
  const statuses = useMemo(() => Array.from(new Set(clients.map(client => client.status))).sort(), [clients])
  const filtered = useMemo(() => {
    const term = normalize(search.trim())
    const results = clients.filter(client =>
      (!term || normalize([client.name, client.industry, client.accountManager?.name].filter(Boolean).join(' ')).includes(term)) &&
      (status === 'all' || client.status === status) &&
      (manager === 'all' || (manager === 'unassigned' ? !client.accountManager : client.accountManager?.id === manager))
    )
    return results.sort((a, b) => {
      const byName = a.name.localeCompare(b.name, 'pt', { sensitivity: 'base', numeric: true })
      if (sort === 'name-desc') return -byName
      if (sort === 'contents') return (b._count?.contents ?? 0) - (a._count?.contents ?? 0) || byName
      if (sort === 'recent') return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || byName
      return byName
    })
  }, [clients, search, status, manager, sort])
  const hasFilters = Boolean(search.trim() || status !== 'all' || manager !== 'all')
  const setSearch = (value: string) => setSearchParams(previous => {
    const next = new URLSearchParams(previous)
    if (value) next.set('q', value); else next.delete('q')
    return next
  }, { replace: true })
  const resetFilters = () => { setSearch(''); setStatus('all'); setManager('all') }

  return (
    <Page>
      <PageHeader title="Clientes" description="As marcas da agência, seus Brand Brains e conteúdos associados."
        actions={<Button asChild><Link to="/app/clients/new"><Plus size={16} aria-hidden />Novo cliente</Link></Button>} />
      <section aria-label="Pesquisa e filtros de clientes" className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div role="search" className="min-w-0 flex-1">
            <label htmlFor="client-search" className="sr-only">Pesquisar clientes</label>
            <Input id="client-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar clientes…" icon={<Search aria-hidden />} aria-controls="clients-results" autoComplete="off" />
          </div>
          <FilterMenu active={manager !== 'all' ? 1 : 0} onClear={() => setManager('all')}>
            <FilterField label="Gestor">
              <Select value={manager} onValueChange={setManager}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos os gestores</SelectItem><SelectItem value="unassigned">Sem gestor</SelectItem>{managers.map(value => <SelectItem key={value.id} value={value.id}>{value.name}</SelectItem>)}</SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Ordenar por">
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="name-asc">Nome · A–Z</SelectItem><SelectItem value="name-desc">Nome · Z–A</SelectItem><SelectItem value="contents">Mais conteúdos</SelectItem><SelectItem value="recent">Mais recentes</SelectItem></SelectContent>
              </Select>
            </FilterField>
          </FilterMenu>
          <ViewToggle value={view} onChange={changeView} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div role="radiogroup" aria-label="Status" className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[...STATUS_FILTERS, ...statuses.filter(value => !STATUS_FILTERS.some(option => option.value === value)).map(value => ({ value, label: statusLabels[value] || value }))].map(option => (
              <button key={option.value} type="button" role="radio" aria-checked={status === option.value} onClick={() => setStatus(option.value)}
                className={`h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${status === option.value ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>
                {option.label}
              </button>
            ))}
          </div>
          <p role="status" aria-live="polite" aria-atomic="true" className="shrink-0 text-[13px] text-muted-foreground">
            {query.isLoading ? 'Carregando…' : query.isError ? 'Indisponível' : hasFilters ? `${filtered.length} de ${clients.length}` : `${clients.length} ${clients.length === 1 ? 'cliente' : 'clientes'}`}
          </p>
        </div>
      </section>
      <section id="clients-results" aria-label="Lista de clientes" aria-busy={query.isFetching}>
        {query.isLoading ? (
          <div className={gridClass} aria-hidden>
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="min-h-[224px] space-y-4 rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3"><Skeleton className="size-11 shrink-0 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>
                <div className="space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div>
                <div className="border-t border-border pt-4"><Skeleton className="h-3 w-2/3" /></div>
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <div role="alert"><EmptyState icon={AlertCircle} title="Não foi possível carregar os clientes" description={getErrorMessage(query.error)} action={<Button variant="outline" onClick={() => void query.refetch()} loading={query.isFetching}><RefreshCw size={15} aria-hidden />Tentar novamente</Button>} /></div>
        ) : !clients.length ? (
          <EmptyState icon={Building2} title="A sua lista de clientes começa aqui" description="Adicione o primeiro cliente para organizar a marca, a estratégia e os conteúdos num só lugar." action={<Button asChild><Link to="/app/clients/new"><Plus size={16} aria-hidden />Adicionar cliente</Link></Button>} />
        ) : !filtered.length ? (
          <EmptyState icon={Search} title="Nenhum cliente corresponde à pesquisa" description="Experimente outro nome, setor ou gestor, ou remova os filtros para voltar à lista completa." action={<Button variant="outline" onClick={resetFilters}>Limpar pesquisa e filtros</Button>} />
        ) : (
          view === 'list'
            ? <ul className="divide-y divide-border/70 overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-card">{filtered.map(client => <ClientRow key={client.id} client={client} />)}</ul>
            : <div className={gridClass}>{filtered.map(client => <ClientCard key={client.id} client={client} onDescription={setSelectedClient} />)}</div>
        )}
      </section>
      <Dialog open={Boolean(selectedClient)} onOpenChange={open => { if (!open) setSelectedClient(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedClient?.name}</DialogTitle><DialogDescription>Descrição do cliente</DialogDescription></DialogHeader>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{selectedClient?.description}</p>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
