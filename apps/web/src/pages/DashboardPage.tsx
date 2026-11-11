import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertCircle, AlertTriangle, ArrowRight, BadgeCheck, CalendarDays, CalendarRange,
  CheckCircle2, ChevronDown, ChevronRight, FilePlus2, FileText, Plus, RefreshCw, Send, Sparkles, Users,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { cn, getInitials, PLATFORM_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Page } from '@/components/layout/Page'
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner'
import { AreaChart } from '@/components/charts/AreaChart'
import { DonutChart, DonutLegend, type DonutSlice } from '@/components/charts/DonutChart'
import { KpiBadge, KpiCard, Panel, PanelHeader, Segmented, ShareBar, Trend, TrendBadge } from '@/components/dashboard/DashboardWidgets'
import { BRAND_COLORS, BrandIcon } from '@/components/brand/BrandIcon'
import { PlatformIcon } from '@/components/planner/PlatformIcon'
import { getPrimaryImage } from '@/components/planner/plannerUtils'
import { buildDashboardAttention, getUpcomingPublications, type AttentionAlert, type AttentionItem, type DashboardContent, type DashboardOverview } from '@/components/dashboard/dashboardModel'

type AgencyNotification = { id: string; title: string; message: string; createdAt: string; data: string | null }
const interaction = 'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 motion-reduce:transition-none'

function AttentionRow({ alert }: { alert: AttentionAlert }) {
  const Icon = alert.kind === 'failure' ? AlertCircle : alert.kind === 'approval' ? BadgeCheck : AlertTriangle
  const platforms = alert.platforms?.map(platform => PLATFORM_LABELS[platform] || platform).join(', ')
  return (
    <li>
      <Link to={alert.to} state={alert.state} aria-label={`${alert.action}: ${alert.title}, ${alert.clientName ? `${alert.clientName}, ` : ''}${alert.description}, ${platforms || alert.badge}`}
        className={cn('group grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-lg p-3 hover:bg-muted/60 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:p-4', interaction)}>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', alert.tone === 'error' ? 'bg-error/10 text-error-dark dark:text-error-light' : 'bg-warning/10 text-warning-dark dark:text-warning-light')}><Icon size={17} aria-hidden /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[13px] font-semibold leading-5">{alert.title}</h3>
            <Badge variant={alert.tone} className="font-medium" title={platforms ? `${alert.badge}: ${platforms}` : undefined}>{alert.platforms?.length === 1 ? platforms : alert.badge}</Badge>
          </div>
          <p className="mt-1 line-clamp-2 break-words text-[13px] leading-5 text-muted-foreground">
            {alert.clientName && <span className="font-medium text-foreground/80">{alert.clientName}<span aria-hidden className="px-1.5 text-muted-foreground">·</span></span>}{alert.description}
          </p>
        </div>
        <span className="col-start-2 inline-flex items-center gap-1.5 text-xs font-medium text-foreground/85 group-hover:text-primary-dark dark:group-hover:text-primary-light sm:col-start-3"><span>{alert.action}</span><ChevronRight size={14} aria-hidden /></span>
      </Link>
    </li>
  )
}

// Content-type tag on the thumbnail (Stitch "Próximas publicações").
const TYPE_TAG: Record<string, string> = { CAROUSEL: 'CAR', REEL: 'REEL', VIDEO: 'VÍD', STORY: 'STORY', IMAGE: 'IMG' }

function UpcomingPublication({ content }: { content: DashboardContent }) {
  const [imageFailed, setImageFailed] = useState(false)
  const image = getPrimaryImage(content)
  const date = new Date(content.scheduledAt!)
  return (
    <li>
      <Link to={`/app/content/${content.id}`} className={cn('group flex min-w-0 items-center gap-3.5 rounded-xl px-3 py-3 hover:bg-muted/60', interaction)}>
        <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted">
          {image && !imageFailed ? <img src={image.publicUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" onError={() => setImageFailed(true)} /> : <FileText size={22} aria-hidden className="text-muted-foreground" />}
          {content.contentType && TYPE_TAG[content.contentType] && (
            <span className="absolute bottom-1 right-1 rounded bg-[#000]/70 px-1 text-[11px] font-semibold uppercase leading-[14px] text-[#fff]">{TYPE_TAG[content.contentType]}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <time dateTime={content.scheduledAt!} className="text-[13px] font-semibold text-primary-dark dark:text-primary-light">{format(date, "d MMM · HH:mm", { locale: ptBR })}</time>
            {content.status === 'SCHEDULED' && <span className="shrink-0 text-xs font-medium text-primary-dark dark:text-primary-light">Agendado</span>}
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{content.title}</h3>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{content.client?.name || 'Cliente não disponível'}</span>
            {content.platforms.length > 0 && <span className="inline-flex items-center gap-1.5" aria-label={content.platforms.map(platform => PLATFORM_LABELS[platform.platform] || platform.platform).join(', ')}>{content.platforms.map(platform => <span key={platform.id} aria-hidden><PlatformIcon platform={platform.platform} size={12} /></span>)}</span>}
          </div>
        </div>
      </Link>
    </li>
  )
}

function notificationTarget(notification: AgencyNotification) {
  try {
    const id = JSON.parse(notification.data || '{}').entityId
    return typeof id === 'string' && /^[\w-]+$/.test(id) ? `/app/content/${id}` : null
  } catch { return null }
}

type Range = '30d' | '90d' | '12m'
type Insights = {
  range: Range
  bucket: 'day' | 'week' | 'month'
  series: { key: string; label: string; created: number; published: number }[]
  kpis: {
    created: { value: number; delta: number | null }
    published: { value: number; delta: number | null }
    clients: { value: number; added: number; delta: number | null }
    scheduled: { value: number }
  }
  status: { status: string; count: number }[]
  platforms: { platform: string; count: number; failed: number }[]
  topClients: { id: string; name?: string; logoUrl?: string | null; industry?: string | null; count: number }[]
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '12m', label: '12 meses' },
]
const RANGE_SUFFIX: Record<Range, string> = { '30d': 'vs 30 dias anteriores', '90d': 'vs 90 dias anteriores', '12m': 'vs 12 meses anteriores' }

const SERIES_COLORS = { created: '#00A76F', published: '#00B8D9' }

// Status ring: production pipeline from idea to published.
const STATUS_GROUPS: { key: string; label: string; statuses: string[]; color: string }[] = [
  { key: 'draft', label: 'Rascunho / ideia', statuses: ['IDEA', 'DRAFT'], color: '#919EAB' },
  { key: 'production', label: 'Em produção', statuses: ['IN_PRODUCTION', 'INTERNAL_REVIEW'], color: '#00B8D9' },
  { key: 'review', label: 'Com o cliente', statuses: ['CLIENT_REVIEW', 'CHANGES_REQUESTED'], color: '#FFAB00' },
  { key: 'ready', label: 'Aprovado / agendado', statuses: ['APPROVED', 'SCHEDULED'], color: '#8E33FF' },
  { key: 'published', label: 'Publicado', statuses: ['PUBLISHED'], color: '#00A76F' },
  { key: 'failed', label: 'Falhou', statuses: ['FAILED'], color: '#FF5630' },
]

const platformColor = (platform: string) => {
  const c = BRAND_COLORS[platform]
  return !c || c === 'currentColor' ? 'hsl(var(--foreground))' : c
}

const linkAction = cn('rounded text-[13px] font-medium text-primary-dark hover:underline dark:text-primary-light', interaction)

/** Shorter chart on phones so the card doesn't dominate the screen. */
function useChartHeight() {
  const query = '(min-width: 640px)'
  const [wide, setWide] = useState(() => typeof window === 'undefined' || window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const update = () => setWide(mql.matches)
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])
  return wide ? 300 : 220
}

export function DashboardPage() {
  const user = useAuthStore(state => state.user)
  const agencyId = user?.agency.id
  const [range, setRange] = useState<Range>('30d')
  const chartHeight = useChartHeight()
  const core = useQuery({
    queryKey: ['dashboard', 'summary', agencyId],
    queryFn: async ({ signal }) => {
      const [overview, attention] = await Promise.all([
        api.get<DashboardOverview>('/dashboard/overview', { signal }),
        api.get<{ items: AttentionItem[] }>('/dashboard/attention', { signal }),
      ])
      return { overview: overview.data, attention: attention.data.items }
    },
    retry: 1,
  })
  const insights = useQuery({
    queryKey: ['dashboard', 'insights', agencyId, range],
    queryFn: async ({ signal }) => (await api.get<Insights>('/dashboard/insights', { params: { range }, signal })).data,
    placeholderData: (previous) => previous,
    retry: 1,
  })
  const contents = useQuery({
    queryKey: ['dashboard', 'contents', agencyId],
    queryFn: async ({ signal }) => {
      const contents: DashboardContent[] = []
      let page = 1
      while (true) {
        const { data } = await api.get<{ data: DashboardContent[]; total: number }>('/contents', { params: { page, limit: 100 }, signal })
        contents.push(...data.data)
        if (!data.data.length || contents.length >= data.total) return contents
        page++
      }
    },
    retry: 1,
  })
  const notifications = useQuery({
    queryKey: ['dashboard', 'notifications', agencyId, user?.id],
    queryFn: async ({ signal }) => (await api.get<{ notifications: AgencyNotification[] }>('/notifications', { signal })).data.notifications,
    retry: false,
  })
  const now = new Date()
  const dateLabel = format(now, "EEEE, d 'de' MMMM", { locale: ptBR })
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const overview = core.data?.overview
  const attention = useMemo(() => core.data ? buildDashboardAttention(core.data.overview, core.data.attention, contents.data || []) : { alerts: [], planning: [] }, [core.data, contents.data])
  const upcoming = getUpcomingPublications(contents.data || [], now.getTime())
  const activities = (notifications.data || []).filter(item => Number.isFinite(Date.parse(item.createdAt))).slice(0, 4)
  const data = insights.data
  const refresh = () => { void core.refetch(); void insights.refetch(); void contents.refetch(); void notifications.refetch() }

  const statusSlices: DonutSlice[] = useMemo(() => STATUS_GROUPS.map(group => ({
    key: group.key,
    label: group.label,
    color: group.color,
    value: (data?.status || []).filter(row => group.statuses.includes(row.status)).reduce((sum, row) => sum + row.count, 0),
  })).filter(slice => slice.value > 0), [data])
  const platformMax = Math.max(0, ...(data?.platforms || []).map(p => p.count))
  const seriesLabel = (index: number) => {
    const point = data?.series[index]
    if (!point || !data) return ''
    const date = new Date(`${point.key}T12:00:00`)
    if (data.bucket === 'month') return format(date, "MMMM 'de' yyyy", { locale: ptBR })
    if (data.bucket === 'week') return `Semana de ${format(date, "d 'de' MMM", { locale: ptBR })}`
    return format(date, "EEEE, d 'de' MMM", { locale: ptBR })
  }
  const pending = overview?.pendingApprovals ?? 0
  const failed = overview?.failedPublications ?? 0

  const attentionBlock = (
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] lg:gap-6">
        <Panel id="dashboard-attention" tabIndex={-1} className="scroll-mt-6 p-3 sm:p-4" aria-label="Centro de atenção">
          <div className="px-2 pt-2 sm:px-3">
            <PanelHeader title="Centro de atenção" description="Resolva primeiro o que pode bloquear a operação."
              action={attention.alerts.length > 0 ? <Badge variant="warning" dot>{attention.alerts.length} {attention.alerts.length > 1 ? 'pendentes' : 'pendente'}</Badge> : undefined} />
          </div>
          {core.isLoading || contents.isLoading ? <div aria-busy="true" aria-label="Carregando prioridades" className="space-y-3 p-2">{[0, 1, 2].map(item => <Skeleton key={item} className="h-20" />)}</div>
            : core.isError ? <p role="status" className="px-2 py-5 text-[13px] text-muted-foreground">As prioridades aparecerão quando o resumo estiver disponível.</p>
            : <>
              {contents.isError && <div role="status" className="mb-3 rounded-lg bg-warning/10 p-3 text-xs leading-5 text-foreground">Os totais estão disponíveis, mas não foi possível consultar os detalhes dos conteúdos. <button type="button" onClick={() => void contents.refetch()} className="font-medium underline underline-offset-4">Tentar novamente</button></div>}
              {attention.alerts.length ? <ul className="space-y-1">{attention.alerts.map(alert => <AttentionRow key={alert.id} alert={alert} />)}</ul> : <div className="flex items-start gap-3 px-2 py-6"><CheckCircle2 size={20} aria-hidden className="mt-0.5 shrink-0 text-primary-dark dark:text-primary-light" /><div><h3 className="text-sm font-medium">Sem bloqueios nesta lista</h3><p className="mt-1 text-[13px] leading-5 text-muted-foreground">Acompanhe o calendário para manter as próximas entregas em dia.</p></div></div>}
              {attention.planning.length > 0 && <details className="group/planning mx-1 mt-4 rounded-xl bg-muted/40">
                <summary className={cn('flex cursor-pointer list-none items-center gap-3 rounded-xl p-3 [&::-webkit-details-marker]:hidden', interaction)}>
                  <CalendarRange size={17} aria-hidden className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1"><h3 className="text-[13px] font-medium">Planejamento de {attention.planning.length} {attention.planning.length === 1 ? 'cliente' : 'clientes'}</h3><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Sem publicações nos próximos 7 dias</p></div>
                  <ChevronDown size={15} aria-hidden className="shrink-0 text-muted-foreground transition-transform group-open/planning:rotate-180 motion-reduce:transition-none" />
                </summary>
                <ul className="space-y-1 px-3 pb-3">{attention.planning.map(item => <li key={item.clientId}><Link to="/app/content/calendar" state={{ clientId: item.clientId }} className={cn('flex min-h-10 items-center justify-between gap-3 rounded-md px-2 py-2 text-xs hover:bg-card', interaction)}><span className="min-w-0 truncate">{item.clientName}</span><span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary-dark dark:text-primary-light">Planejar<ArrowRight size={13} aria-hidden /></span></Link></li>)}</ul>
              </details>}
            </>}
        </Panel>

        <Panel aria-label="Atividade recente">
          <PanelHeader title="Atividade recente" description="Notificações da sua conta." />
          {notifications.isLoading ? <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>
            : activities.length ? <ul className="-mx-2 space-y-1">{activities.map(item => {
              const candidate = notificationTarget(item)
              const to = candidate && contents.data?.some(content => candidate === `/app/content/${content.id}`) ? candidate : null
              const date = new Date(item.createdAt)
              const body = <><span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/70" aria-hidden /><div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-[13px] font-medium leading-5">{item.title}</h3><p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.message}</p><time dateTime={item.createdAt} title={format(date, 'd MMM yyyy · HH:mm', { locale: ptBR })} className="mt-1 block text-xs leading-5 text-muted-foreground">{formatDistanceToNowStrict(date, { addSuffix: true, locale: ptBR })}</time></div>{to && <ChevronRight size={14} aria-hidden className="mt-1 shrink-0 text-muted-foreground" />}</>
              return <li key={item.id}>{to ? <Link to={to} className={cn('flex items-start gap-3 rounded-xl p-2 hover:bg-muted/60', interaction)}>{body}</Link> : <div className="flex items-start gap-3 p-2">{body}</div>}</li>
            })}</ul>
            : <div className="flex items-center gap-3 py-4 text-[13px] text-muted-foreground"><Users size={18} aria-hidden />Sem atividade recente.</div>}
        </Panel>
      </div>
  )

  return (
    <Page className="space-y-5 lg:space-y-6">
      <WelcomeBanner
        date={<time dateTime={format(now, 'yyyy-MM-dd')}>{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</time>}
        title={`${greeting}${firstName ? `, ${firstName}` : ''}`}
        description="Acompanhe a produção, as aprovações e as publicações da agência em um só lugar."
        highlights={[
          core.isLoading ? null : attention.alerts.length
            ? <><span className="size-1.5 rounded-full bg-[#FFD666]" aria-hidden />{attention.alerts.length} {attention.alerts.length === 1 ? 'item precisa' : 'itens precisam'} de atenção</>
            : <><CheckCircle2 size={14} aria-hidden />Sem bloqueios hoje</>,
          upcoming[0]?.scheduledAt
            ? <><CalendarDays size={14} aria-hidden />Próxima publicação {format(new Date(upcoming[0].scheduledAt), "d MMM 'às' HH:mm", { locale: ptBR })}</>
            : null,
          overview ? <><Users size={14} aria-hidden />{overview.activeClients} {overview.activeClients === 1 ? 'cliente ativo' : 'clientes ativos'}</> : null,
        ].filter(Boolean)}
      />

      {/* KPI row */}
      {core.isError && insights.isError ? (
        <Panel role="alert"><h2 className="text-sm font-semibold">Não foi possível carregar o estado da agência</h2><p className="mt-1 text-[13px] text-muted-foreground">Tente novamente para consultar os indicadores e as prioridades atuais.</p><Button variant="outline" onClick={refresh} loading={core.isFetching} className="mt-4"><RefreshCw size={14} aria-hidden />Tentar novamente</Button></Panel>
      ) : (
        <section aria-label="Indicadores principais" aria-busy={insights.isLoading || core.isLoading} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 lg:gap-5">
          {insights.isLoading && core.isLoading
            ? Array.from({ length: 4 }, (_, i) => <div key={i} aria-hidden className="flex gap-4 rounded-[20px] border border-border/70 bg-card p-5"><Skeleton className="size-12 rounded-2xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-7 w-16" /><Skeleton className="h-3 w-1/2" /></div></div>)
            : <>
              <KpiCard label="Conteúdos criados" icon={FilePlus2} tone="brand" to="/app/content"
                value={data?.kpis.created.value ?? overview?.totalContentsThisMonth ?? 0}
                badge={<TrendBadge value={data?.kpis.created.delta} />}
                sparkline={data?.series.map(point => point.created)}
                footer={data ? (data.kpis.created.delta === null ? 'Primeiro período com dados' : RANGE_SUFFIX[range]) : 'Este mês'} />
              <KpiCard label="Publicados" icon={Send} tone="info" to="/app/content"
                value={data?.kpis.published.value ?? overview?.publishedThisMonth ?? 0}
                badge={<TrendBadge value={data?.kpis.published.delta} />}
                sparkline={data?.series.map(point => point.published)}
                footer={data ? (data.kpis.published.delta === null ? 'Primeiro período com dados' : RANGE_SUFFIX[range]) : 'Este mês'} />
              <KpiCard label="Aguardando aprovação" icon={BadgeCheck} tone="warning" to="/app/approvals" alert={pending > 0} value={pending}
                badge={pending > 0 ? <KpiBadge tone="warning" className="hidden sm:inline-flex">Ação necessária</KpiBadge> : undefined}
                footer={(overview?.changesRequested ?? 0) > 0 ? `${overview?.changesRequested} com ajustes pedidos` : 'Em revisão do cliente'} />
              <KpiCard label="Falhas de publicação" icon={AlertCircle} tone="error" to="#dashboard-attention" alert={failed > 0} value={failed}
                badge={failed > 0 ? <KpiBadge tone="error" className="hidden sm:inline-flex">Atenção imediata</KpiBadge> : undefined}
                footer={failed > 0 ? <span className="inline-flex items-center gap-1 font-medium text-error-dark dark:text-error"><AlertTriangle size={13} aria-hidden />Rever no centro de atenção</span> : 'Tudo publicado com sucesso'} />
            </>}
        </section>
      )}

      {/* Main chart + upcoming */}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] lg:gap-6">
        <Panel aria-label="Produção de conteúdo">
          <PanelHeader
            title="Produção de conteúdo"
            description="Criados e publicados ao longo do período."
            action={<Segmented label="Período" value={range} options={RANGE_OPTIONS} onChange={setRange} />}
          />
          {data && (
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[32px] font-bold leading-none tracking-[-0.03em] tabular-nums">{data.kpis.created.value}</span>
              <span className="text-sm text-muted-foreground">conteúdos criados</span>
              <Trend value={data.kpis.created.delta} suffix="" />
              <span className="ml-auto hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: SERIES_COLORS.created }} />Criados</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: SERIES_COLORS.published }} />Publicados</span>
              </span>
            </div>
          )}
          {insights.isLoading ? <Skeleton className="h-[280px] rounded-xl" />
            : insights.isError ? <div role="status" className="flex h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center text-[13px] text-muted-foreground"><p>Não foi possível carregar o histórico.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void insights.refetch()}>Tentar novamente</Button></div>
            : data && <div className={cn('transition-opacity', insights.isFetching && 'opacity-60')}>
              <AreaChart
                height={chartHeight}
                labels={data.series.map(point => point.label)}
                formatLabel={seriesLabel}
                series={[
                  { key: 'created', label: 'Criados', color: SERIES_COLORS.created, values: data.series.map(point => point.created) },
                  { key: 'published', label: 'Publicados', color: SERIES_COLORS.published, values: data.series.map(point => point.published) },
                ]}
              />
            </div>}
        </Panel>

        <Panel aria-label="Próximas publicações">
          <PanelHeader title="Próximas publicações" description="O que vai sair a seguir." action={<Link to="/app/content/calendar" className={linkAction}>Ver todas</Link>} />
          {contents.isLoading ? <div aria-busy="true" aria-label="Carregando publicações" className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            : contents.isError ? <div role="status" className="py-6 text-[13px] text-muted-foreground"><p>Não foi possível consultar o calendário.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void contents.refetch()}>Tentar novamente</Button></div>
            : upcoming.length ? <ul className="-mx-3 divide-y divide-border/70">{upcoming.map(content => <UpcomingPublication key={content.id} content={content} />)}</ul>
            : <div className="flex flex-1 flex-col items-center justify-center py-6 text-center"><span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark dark:text-primary-light"><CalendarDays size={21} aria-hidden /></span><h3 className="text-[15px] font-semibold">Prepare a próxima publicação</h3><p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">Ainda não há conteúdos futuros agendados.</p><Button asChild variant="outline" className="mt-5"><Link to="/app/content/calendar">Abrir Planner<ArrowRight size={14} aria-hidden /></Link></Button></div>}
        </Panel>
      </div>

      {/* Analytics row */}
      <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3 lg:gap-6">
        <Panel aria-label="Conteúdos por status">
          <PanelHeader title="Conteúdos por status" description="Pipeline atual da agência." />
          {insights.isLoading ? <Skeleton className="mx-auto size-[180px] rounded-full" />
            : statusSlices.length ? <div className="flex flex-col items-center gap-6 sm:flex-row xl:flex-col 2xl:flex-row">
              <DonutChart slices={statusSlices} caption="Conteúdos" size={180} />
              <DonutLegend slices={statusSlices} className="w-full min-w-0" />
            </div>
            : <p className="py-8 text-center text-[13px] text-muted-foreground">Ainda não há conteúdos.</p>}
        </Panel>

        <Panel aria-label="Publicações por rede">
          <PanelHeader title="Por rede social" description={`Publicações planejadas · ${RANGE_OPTIONS.find(o => o.value === range)?.label}`} />
          {insights.isLoading ? <div className="space-y-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-9" />)}</div>
            : data?.platforms.length ? <ul className="space-y-5">{data.platforms.slice(0, 6).map(row => (
              <li key={row.platform} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/50"><BrandIcon platform={row.platform} size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-semibold text-foreground">{PLATFORM_LABELS[row.platform] || row.platform}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{row.count}{row.failed > 0 && <span className="ml-1.5 text-xs font-medium text-error-dark dark:text-error">· {row.failed} {row.failed > 1 ? 'falhas' : 'falha'}</span>}</span>
                  </div>
                  <ShareBar value={row.count} max={platformMax} color={platformColor(row.platform)} />
                </div>
              </li>
            ))}</ul>
            : <p className="py-8 text-center text-[13px] text-muted-foreground">Sem publicações planejadas neste período.</p>}
        </Panel>

        <Panel aria-label="Clientes mais ativos" className="md:col-span-2 xl:col-span-1">
          <PanelHeader title="Clientes mais ativos"
            description={data ? `${data.kpis.clients.value} clientes ativos${data.kpis.clients.added ? ` · ${data.kpis.clients.added} ${data.kpis.clients.added > 1 ? 'novos' : 'novo'}` : ''}` : 'Por conteúdos criados no período.'}
            action={<Link to="/app/clients" className={linkAction}>Ver todos</Link>} />
          {insights.isLoading ? <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-11" />)}</div>
            : data?.topClients.length ? <ul className="-mx-3 divide-y divide-border/70">{data.topClients.map(client => (
              <li key={client.id}>
                <Link to={`/app/clients/${client.id}`} className={cn('flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-muted/60', interaction)}>
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-muted text-xs font-semibold text-foreground/70">
                    {client.logoUrl ? <img src={client.logoUrl} alt="" loading="lazy" className="size-full object-cover" /> : getInitials(client.name || '?')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{client.name || 'Cliente'}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{client.industry || 'Setor não informado'}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[15px] font-bold tabular-nums text-primary-dark dark:text-primary-light">{client.count}</span>
                    <span className="block text-[11px] text-muted-foreground">{client.count > 1 ? 'conteúdos' : 'conteúdo'}</span>
                  </span>
                </Link>
              </li>
            ))}</ul>
            : <p className="py-8 text-center text-[13px] text-muted-foreground">Nenhum conteúdo criado neste período.</p>}
        </Panel>
      </div>

      {/* Attention + activity */}
      {attentionBlock}
    </Page>
  )
}
