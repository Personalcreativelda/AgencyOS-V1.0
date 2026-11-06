import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertCircle, AlertTriangle, ArrowRight, BadgeCheck, CalendarDays, CalendarRange,
  CheckCircle2, ChevronDown, ChevronRight, FileBarChart, FileText, Plus, RefreshCw, Users,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { cn, PLATFORM_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Page, PageHeader } from '@/components/layout/Page'
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

function UpcomingPublication({ content }: { content: DashboardContent }) {
  const [imageFailed, setImageFailed] = useState(false)
  const image = getPrimaryImage(content)
  const date = new Date(content.scheduledAt!)
  return (
    <li>
      <Link to={`/app/content/${content.id}`} className={cn('group flex min-w-0 gap-3 rounded-lg p-3 hover:bg-muted/60', interaction)}>
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {image && !imageFailed ? <img src={image.publicUrl} alt="" loading="lazy" className="size-full object-cover" onError={() => setImageFailed(true)} /> : <FileText size={22} aria-hidden className="text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <time dateTime={content.scheduledAt!} className="text-xs font-medium text-primary-dark dark:text-primary-light">{format(date, "d MMM · HH:mm", { locale: ptBR })}</time>
          <h3 className="mt-1 line-clamp-2 text-[13px] font-medium leading-5">{content.title}</h3>
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

export function DashboardPage() {
  const user = useAuthStore(state => state.user)
  const agencyId = user?.agency.id
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
  const activities = (notifications.data || []).filter(item => Number.isFinite(Date.parse(item.createdAt))).slice(0, 3)
  const metrics = overview ? [
    { label: 'Clientes ativos', value: overview.activeClients, hint: 'Marcas acompanhadas', icon: Users, to: '/app/clients', tone: 'brand' },
    { label: 'Aprovações pendentes', value: overview.pendingApprovals, hint: 'Conteúdos em revisão do cliente', icon: BadgeCheck, to: '/app/content', state: { status: 'CLIENT_REVIEW' }, tone: overview.pendingApprovals > 0 ? 'warning' : 'default' },
    { label: 'Conteúdos agendados', value: overview.scheduledContents, hint: 'Na fila de publicação', icon: CalendarDays, to: '/app/content/calendar', tone: 'default' },
    { label: 'Falhas de publicação', value: overview.failedPublications, hint: 'Contadas por plataforma', icon: AlertCircle, to: '#dashboard-attention', tone: overview.failedPublications > 0 ? 'error' : 'default' },
  ] : []
  const refresh = () => { void core.refetch(); void contents.refetch(); void notifications.refetch() }

  return (
    <Page className="space-y-7 lg:space-y-8">
      <PageHeader
        eyebrow={<time dateTime={format(now, 'yyyy-MM-dd')} className="font-normal">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</time>}
        title={`${greeting}${firstName ? `, ${firstName}` : ''}.`}
        description="Acompanhe a agência, resolva prioridades e prepare as próximas publicações."
        className="[&_h1]:text-[28px] sm:[&_h1]:text-[32px]"
        actions={<><Button asChild variant="outline"><Link to="/app/clients/new"><Plus size={15} aria-hidden />Novo cliente</Link></Button><Button asChild><Link to="/app/content" state={{ create: true }}><Plus size={15} aria-hidden />Criar conteúdo</Link></Button></>}
      />

      {core.isError ? (
        <div role="alert" className="rounded-xl bg-card p-5"><h2 className="text-sm font-semibold">Não foi possível carregar o estado da agência</h2><p className="mt-1 text-[13px] text-muted-foreground">Tente novamente para consultar os indicadores e as prioridades atuais.</p><Button variant="outline" onClick={refresh} loading={core.isFetching} className="mt-4"><RefreshCw size={14} aria-hidden />Tentar novamente</Button></div>
      ) : (
        <section aria-label="Indicadores principais da agência" aria-busy={core.isLoading} className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {core.isLoading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="min-h-40 space-y-4 rounded-xl bg-card p-4 sm:p-5" aria-hidden><Skeleton className="h-5 w-4/5" /><Skeleton className="h-10 w-16" /><Skeleton className="h-3 w-full" /></div>) : metrics.map(metric => {
            const body = <><div className="flex min-h-10 items-start justify-between gap-2"><h2 className="text-[13px] font-medium leading-5 text-muted-foreground">{metric.label}</h2><metric.icon size={17} aria-hidden className={cn('mt-0.5 shrink-0', metric.tone === 'error' ? 'text-error-dark dark:text-error-light' : metric.tone === 'warning' ? 'text-warning-dark dark:text-warning-light' : 'text-muted-foreground')} /></div><p className={cn('mt-2 text-4xl font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[40px]', metric.tone === 'error' ? 'text-error-dark dark:text-error-light' : metric.tone === 'warning' ? 'text-warning-dark dark:text-warning-light' : 'text-foreground')}>{metric.value}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">{metric.hint}</p></>
            const classes = cn('group min-w-0 rounded-xl bg-card p-4 ring-1 ring-inset ring-border/30 hover:bg-muted/60 sm:p-5', interaction)
            return metric.to.startsWith('#') ? <a key={metric.label} href={metric.to} className={classes}>{body}</a> : <Link key={metric.label} to={metric.to} state={metric.state} className={classes}>{body}</Link>
          })}
        </section>
      )}

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] lg:gap-6">
        <Card id="dashboard-attention" tabIndex={-1} className="min-w-0 scroll-mt-6 border-border/50 p-3 sm:p-4">
          <div className="px-2 pb-4 pt-2"><SectionTitle title="Centro de atenção" description="Resolva primeiro o que pode bloquear a operação." /></div>
          {core.isLoading || contents.isLoading ? <div aria-busy="true" aria-label="Carregando prioridades" className="space-y-3 p-2">{[0, 1, 2].map(item => <Skeleton key={item} className="h-24" />)}</div>
          : core.isError ? <p role="status" className="px-2 py-5 text-[13px] text-muted-foreground">As prioridades aparecerão quando o resumo estiver disponível.</p>
          : <>
            {contents.isError && <div role="status" className="mb-3 rounded-lg bg-warning/10 p-3 text-xs leading-5 text-foreground">Os totais estão disponíveis, mas não foi possível consultar os detalhes dos conteúdos. <button type="button" onClick={() => void contents.refetch()} className="font-medium underline underline-offset-4">Tentar novamente</button></div>}
            {attention.alerts.length ? <ul className="space-y-1">{attention.alerts.map(alert => <AttentionRow key={alert.id} alert={alert} />)}</ul> : <div className="flex items-start gap-3 px-2 py-6"><CheckCircle2 size={20} aria-hidden className="mt-0.5 shrink-0 text-primary-dark dark:text-primary-light" /><div><h3 className="text-sm font-medium">Sem bloqueios nesta lista</h3><p className="mt-1 text-[13px] leading-5 text-muted-foreground">Acompanhe o calendário para manter as próximas entregas em dia.</p></div></div>}
            {attention.planning.length > 0 && <details className="group/planning mx-1 mt-4 rounded-lg bg-muted/40">
              <summary className={cn('flex cursor-pointer list-none items-center gap-3 rounded-lg p-3 [&::-webkit-details-marker]:hidden', interaction)}>
                <CalendarRange size={17} aria-hidden className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1"><h3 className="text-[13px] font-medium">Planeamento de {attention.planning.length} {attention.planning.length === 1 ? 'cliente' : 'clientes'}</h3><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Sem publicações nos próximos 7 dias</p></div>
                <ChevronDown size={15} aria-hidden className="shrink-0 text-muted-foreground transition-transform group-open/planning:rotate-180 motion-reduce:transition-none" />
              </summary>
              <ul className="space-y-1 px-3 pb-3">{attention.planning.map(item => <li key={item.clientId}><Link to="/app/content/calendar" state={{ clientId: item.clientId }} className={cn('flex min-h-10 items-center justify-between gap-3 rounded-md px-2 py-2 text-xs hover:bg-card', interaction)}><span className="min-w-0 truncate">{item.clientName}</span><span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary-dark dark:text-primary-light">Planear<ArrowRight size={13} aria-hidden /></span></Link></li>)}</ul>
            </details>}
          </>}
        </Card>

        <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1 lg:gap-6">
          <Card className="min-w-0 border-border/50 p-4 sm:p-5">
            <SectionTitle title="Próximas publicações" description="O que vai sair a seguir." action={upcoming.length > 0 ? <Link to="/app/content/calendar" className={cn('rounded text-xs text-muted-foreground hover:text-foreground', interaction)}>Ver Planner<ChevronRight size={13} aria-hidden className="ml-1 inline" /></Link> : undefined} />
            {contents.isLoading ? <div aria-busy="true" aria-label="Carregando publicações" className="mt-5 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            : contents.isError ? <div role="status" className="py-6 text-[13px] text-muted-foreground"><p>Não foi possível consultar o calendário.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void contents.refetch()}>Tentar novamente</Button></div>
            : upcoming.length ? <ul className="-mx-2 mt-4 space-y-2">{upcoming.map(content => <UpcomingPublication key={content.id} content={content} />)}</ul>
            : <div className="flex flex-col items-start py-6"><span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><CalendarDays size={21} aria-hidden /></span><h3 className="text-sm font-medium">Prepare a próxima publicação</h3><p className="mt-1 max-w-xs text-[13px] leading-6 text-muted-foreground">Ainda não há conteúdos futuros agendados. Organize as próximas entregas no Planner.</p><Button asChild variant="outline" className="mt-5"><Link to="/app/content/calendar">Abrir Planner<ArrowRight size={14} aria-hidden /></Link></Button></div>}
          </Card>

          {activities.length > 0 && <Card className="min-w-0 border-border/50 p-4 sm:p-5">
            <SectionTitle title="Atividade recente" description="Notificações da sua conta na agência." />
            <ul className="mt-4 space-y-1">{activities.map(item => {
              const candidate = notificationTarget(item)
              const to = candidate && contents.data?.some(content => candidate === `/app/content/${content.id}`) ? candidate : null
              const date = new Date(item.createdAt)
              const body = <><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden /><div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-[13px] font-medium leading-5">{item.title}</h3><p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.message}</p><time dateTime={item.createdAt} title={format(date, 'd MMM yyyy · HH:mm', { locale: ptBR })} className="mt-1 block text-xs leading-5 text-muted-foreground">{formatDistanceToNowStrict(date, { addSuffix: true, locale: ptBR })}</time></div>{to && <ChevronRight size={13} aria-hidden className="mt-1 shrink-0 text-muted-foreground" />}</>
              return <li key={item.id}>{to ? <Link to={to} className={cn('-mx-2 flex items-start gap-3 rounded-md p-2 hover:bg-muted/60', interaction)}>{body}</Link> : <div className="flex items-start gap-3 py-2">{body}</div>}</li>
            })}</ul>
          </Card>}
        </div>
      </div>

      <nav aria-label="Atalhos da agência" className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/70 pt-4">
        {[
          { to: '/app/content/calendar', label: 'Planner', icon: CalendarDays },
          { to: '/app/approvals', label: 'Aprovações', icon: BadgeCheck },
          { to: '/app/reports', label: 'Relatórios mensais', icon: FileBarChart },
        ].map(item => <Link key={item.to} to={item.to} className={cn('inline-flex min-h-10 items-center gap-2 rounded-md text-xs text-muted-foreground hover:text-foreground', interaction)}><item.icon size={14} aria-hidden />{item.label}<ArrowRight size={12} aria-hidden /></Link>)}
      </nav>
    </Page>
  )
}
