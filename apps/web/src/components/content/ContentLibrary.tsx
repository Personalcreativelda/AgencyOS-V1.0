import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, FileImage, LayoutGrid, List, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { cn, PLATFORM_LABELS, STATUS_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { ContentGridTile, ContentListRow } from '@/components/planner/ContentGridTile'
import { CreativePreview } from './CreativeMedia'
import { selectLibraryContents, type LibraryContent, type LibrarySort } from './libraryUtils'

type Props = {
  contents: LibraryContent[]; clients: { id: string; name: string }[]
  loading: boolean; error: string; mode: 'rows' | 'grid'; onModeChange: (mode: 'rows' | 'grid') => void
  client: string; status: string; platform: string; statuses: string[]
  onClientChange: (value: string) => void; onStatusChange: (value: string) => void; onPlatformChange: (value: string) => void
  onRetry: () => void; onCreate: () => void; onDelete: (id: string, title: string) => void
}
const ALL = '__all'
const gridClass = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'

export function ContentLibrary(props: Props) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<LibrarySort>('scheduled')
  const [visible, setVisible] = useState(24)
  const [preview, setPreview] = useState<LibraryContent | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtered = useMemo(() => selectLibraryContents(props.contents, search, sort), [props.contents, search, sort])
  const hasFilters = Boolean(search.trim() || props.client || props.status || props.platform)
  const activeFilters = [props.client, props.status, props.platform].filter(Boolean).length
  useEffect(() => { setVisible(24) }, [search, sort, props.client, props.status, props.platform])
  const reset = () => { setSearch(''); props.onClientChange(''); props.onStatusChange(''); props.onPlatformChange('') }
  const controlLabel = 'mb-1.5 block text-xs font-medium text-muted-foreground'
  return (
    <div className="space-y-5">
      <section aria-label="Pesquisa e filtros de criativos" className="space-y-3">
        <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4 xl:grid-cols-[minmax(14rem,1fr)_10rem_10rem_9rem_11rem]">
          <div role="search" className="col-span-2 sm:col-span-4 xl:col-span-1">
            <label htmlFor="creative-search" className={controlLabel}>Pesquisar na biblioteca</label>
            <Input id="creative-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Título, cliente ou legenda…" icon={<Search aria-hidden />} autoComplete="off" aria-controls="creative-library-results" />
          </div>
          <div className="order-1 sm:hidden"><span className={controlLabel}>Refinar</span><Button type="button" variant="outline" className="min-h-10 w-full" aria-label="Filtros de criativos" aria-expanded={filtersOpen} aria-controls="creative-library-filters" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={15} aria-hidden />Filtros{activeFilters > 0 && <span className="tabular-nums">({activeFilters})</span>}</Button></div>
          <div id="creative-library-filters" className={cn('order-2 col-span-2 grid grid-cols-2 gap-3 sm:contents', !filtersOpen && 'hidden')}>
          <div className="col-span-2 sm:col-span-1"><label id="creative-client-label" className={controlLabel}>Cliente</label><Select value={props.client || ALL} onValueChange={value => props.onClientChange(value === ALL ? '' : value)}><SelectTrigger aria-labelledby="creative-client-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos</SelectItem>{props.clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
          <div><label id="creative-status-label" className={controlLabel}>Estado</label><Select value={props.status || ALL} onValueChange={value => props.onStatusChange(value === ALL ? '' : value)}><SelectTrigger aria-labelledby="creative-status-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos</SelectItem>{props.statuses.map(status => <SelectItem key={status} value={status}>{STATUS_LABELS[status] || status}</SelectItem>)}</SelectContent></Select></div>
          <div><label id="creative-platform-label" className={controlLabel}>Rede social</label><Select value={props.platform || ALL} onValueChange={value => props.onPlatformChange(value === ALL ? '' : value)}><SelectTrigger aria-labelledby="creative-platform-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todas</SelectItem>{Object.entries(PLATFORM_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="order-1 sm:order-none"><label id="creative-sort-label" className={controlLabel}>Ordenar por</label><Select value={sort} onValueChange={value => setSort(value as LibrarySort)}><SelectTrigger aria-labelledby="creative-sort-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recent">Mais recentes</SelectItem><SelectItem value="updated">Última alteração</SelectItem><SelectItem value="title">Título · A–Z</SelectItem><SelectItem value="scheduled">Data agendada</SelectItem></SelectContent></Select></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-h-10 flex-wrap items-center gap-3">
            <p role="status" aria-atomic="true" className="text-xs text-muted-foreground">{props.loading ? 'Carregando biblioteca…' : props.error ? 'Biblioteca indisponível' : search.trim() ? `${filtered.length} de ${props.contents.length} criativos` : `${filtered.length} ${filtered.length === 1 ? 'criativo' : 'criativos'}`}</p>
            {hasFilters && <Button variant="ghost" size="sm" onClick={reset}>Limpar filtros</Button>}
          </div>
          <div role="group" aria-label="Visualização da biblioteca" className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
            {([{ mode: 'grid', label: 'Grelha', icon: LayoutGrid }, { mode: 'rows', label: 'Lista', icon: List }] as const).map(item => <button key={item.mode} type="button" onClick={() => props.onModeChange(item.mode)} aria-label={`Mostrar ${item.label.toLowerCase()}`} aria-pressed={props.mode === item.mode} className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 motion-reduce:transition-none', props.mode === item.mode ? 'bg-card text-foreground shadow-z1' : 'text-muted-foreground hover:text-foreground')}><item.icon size={15} aria-hidden />{item.label}</button>)}
          </div>
        </div>
      </section>
      <section id="creative-library-results" aria-labelledby="creative-library-heading" aria-busy={props.loading}>
        <h2 id="creative-library-heading" className="sr-only">Biblioteca de criativos</h2>
        {props.loading ? props.mode === 'grid' ? (
          <div className={gridClass} aria-hidden>{Array.from({ length: 8 }, (_, index) => <div key={index} className="overflow-hidden rounded-xl border border-border bg-card"><Skeleton className="aspect-[4/3] rounded-none" /><div className="space-y-3 p-4"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /><div className="border-t border-border pt-3"><Skeleton className="h-5 w-24" /></div></div></div>)}</div>
        ) : <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card" aria-hidden>{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex items-center gap-4 p-4"><Skeleton className="size-16 shrink-0 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-1/3" /></div></div>)}</div>
        : props.error ? <div role="alert"><EmptyState icon={AlertCircle} title="Não foi possível carregar a biblioteca" description={props.error} action={<Button variant="outline" onClick={props.onRetry}><RefreshCw size={14} aria-hidden />Tentar novamente</Button>} /></div>
        : !filtered.length ? <EmptyState icon={hasFilters ? Search : FileImage} title={hasFilters ? 'Nenhum criativo corresponde à pesquisa' : 'A sua biblioteca começa aqui'} description={hasFilters ? 'Experimente outro título, cliente ou legenda, ou remova os filtros para ver os restantes conteúdos.' : 'Crie um conteúdo e organize aqui as imagens, os vídeos e os carrosséis da agência.'} action={hasFilters ? <Button variant="outline" onClick={reset}>Limpar pesquisa e filtros</Button> : <Button onClick={props.onCreate}><Plus size={15} aria-hidden />Novo conteúdo</Button>} />
        : <>
          <div className={props.mode === 'grid' ? gridClass : 'divide-y divide-border overflow-hidden rounded-xl border border-border bg-card'}>
            {filtered.slice(0, visible).map(content => {
              const Item = props.mode === 'grid' ? ContentGridTile : ContentListRow
              return <Item key={content.id} content={content} onClick={() => navigate(`/app/content/${content.id}`)} onPreview={() => setPreview(content)} onDelete={() => props.onDelete(content.id, content.title)} />
            })}
          </div>
          {filtered.length > visible && <div className="mt-5 flex flex-col items-center gap-2"><p className="text-xs text-muted-foreground">{visible} de {filtered.length} criativos</p><Button variant="outline" onClick={() => setVisible(value => value + 24)}>Mostrar mais</Button></div>}
        </>}
      </section>
      <CreativePreview content={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
