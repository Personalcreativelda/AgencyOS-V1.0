import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BarChart3, ExternalLink, Globe2, MousePointerClick, Pause, Play, Plus, RefreshCw, Sparkles, Trash2, TrendingUp, Users } from 'lucide-react'
import { BrandIcon } from '@/components/brand/BrandIcon'
import api, { cachedGet } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { toast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import { confirmDialog } from '@/lib/confirm'
import { useAuthStore } from '@/stores/authStore'
import { Page, PageHeader, PageIcon } from '@/components/layout/Page'
import { Stat, StatGroup } from '@/components/ui/Stat'
import { RankedBars } from '@/components/charts/MetricTrend'
import { MetricExplorer, type ExplorerRow } from '@/components/charts/MetricExplorer'
import { FilterBar } from '@/components/ui/FilterPills'
import { Segmented } from '@/components/dashboard/DashboardWidgets'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Panel, PanelHeader } from '@/components/dashboard/DashboardWidgets'

type Kind = 'ads' | 'analytics'
type Range = 'today' | '7d' | '30d'
type Connection = { id: string; kind: Kind; name: string; externalId: string; currency?: string | null }
type Option = { id: string; name: string; currency?: string; loginCustomerId?: string }

const number = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value || 0)
const percent = (value: number) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value || 0)}%`
const money = (value: number, currency: string) => {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value || 0) }
  catch { return `${number(value)} ${currency}` }
}

function Metric({ label, value, icon }: { label: string; value: string; icon: typeof Users }) {
  return <Stat label={label} value={value} icon={icon} />
}

function Breakdown({ title, rows, valueKey }: { title: string; rows: any[]; valueKey: string }) {
  return <Panel>
    <PanelHeader title={title} />
    {rows?.length
      ? <RankedBars rows={rows.slice(0, 8).map((row: any) => ({ label: row.label, value: Number(row[valueKey] || 0) }))} format={number} />
      : <p className="text-sm text-muted-foreground">Sem dados neste período.</p>}
  </Panel>
}

const dayLabel = (r: ExplorerRow) => format(new Date(`${String(r.date).slice(0, 10)}T12:00:00`), 'd MMM', { locale: ptBR })
const dayTooltip = (r: ExplorerRow) => format(new Date(`${String(r.date).slice(0, 10)}T12:00:00`), "EEEE, d 'de' MMM", { locale: ptBR })
const GOOGLE_STATUS: Record<string, string> = { ENABLED: 'Ativa', PAUSED: 'Pausada', REMOVED: 'Removida' }

export function GooglePerformancePage() {
  const [statusTab, setStatusTab] = useState<'all' | 'ENABLED' | 'PAUSED'>('all')
  const [campaignQuery, setCampaignQuery] = useState('')
  const role = useAuthStore(state => state.user?.role)
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER'
  const [params, setParams] = useSearchParams()
  const [clients, setClients] = useState<any[]>([])
  const [clientId, setClientId] = useState('')
  const [kind, setKind] = useState<Kind>('ads')
  const [range, setRange] = useState<Range>('7d')
  const [settings, setSettings] = useState<{ configured: boolean; callbackUrl?: string } | null>(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionId, setConnectionId] = useState('')
  const [insights, setInsights] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [changingCampaignId, setChangingCampaignId] = useState('')
  const connectionsRequest = useRef(0)
  const insightsRequest = useRef(0)
  const analysisRequest = useRef(0)
  const selectedConnectionRef = useRef('')
  selectedConnectionRef.current = connectionId
  const [connecting, setConnecting] = useState(false)
  const [pendingToken, setPendingToken] = useState('')
  const [pendingOptions, setPendingOptions] = useState<Option[]>([])
  const [pendingKind, setPendingKind] = useState<Kind>('ads')
  const [selectedOption, setSelectedOption] = useState('')
  const [confirming, setConfirming] = useState(false)
  const visibleConnections = connections.filter(connection => connection.kind === kind)
  const selectedConnection = visibleConnections.find(connection => connection.id === connectionId)

  const loadConnections = async (id: string) => {
    const request = ++connectionsRequest.current
    const { data } = await api.get<Connection[]>('/google/connections', { params: { clientId: id } })
    if (request === connectionsRequest.current) setConnections(data)
  }

  useEffect(() => {
    let active = true
    setLoadError('')
    Promise.allSettled([cachedGet('/clients'), cachedGet('/google/settings')]).then(([clientResult, settingsResult]) => {
      if (!active) return
      if (clientResult.status === 'fulfilled') {
        const list = clientResult.value.data.data || []
        setClients(list)
        const preferred = params.get('clientId')
        setClientId(current => current || list.find((client: any) => client.id === preferred)?.id || list[0]?.id || '')
      } else setLoadError(getErrorMessage(clientResult.reason))
      if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value.data)
      else setLoadError(previous => [previous, `Configuração Google: ${getErrorMessage(settingsResult.reason)}`].filter(Boolean).join(' · '))
    })
    return () => { active = false }
  }, [reloadKey])

  useEffect(() => {
    if (!clientId) return
    setConnections([])
    setConnectionId('')
    setInsights(null)
    setRecommendations([])
    loadConnections(clientId).catch(error => toast.error('Erro ao carregar conexões', getErrorMessage(error)))
  }, [clientId])

  useEffect(() => {
    if (!visibleConnections.some(connection => connection.id === connectionId)) {
      setConnectionId(visibleConnections[0]?.id || '')
      setInsights(null)
    }
  }, [connections, kind, connectionId])

  const refresh = async () => {
    const request = ++insightsRequest.current
    if (!connectionId) { setInsights(null); setLoading(false); return }
    setLoading(true)
    setInsights(null)
    try {
      const { data } = await cachedGet(`/google/connections/${connectionId}/insights`, { params: { range } })
      if (request === insightsRequest.current) setInsights(data)
    } catch (error) { if (request === insightsRequest.current) toast.error('Erro ao carregar métricas Google', getErrorMessage(error)) }
    finally { if (request === insightsRequest.current) setLoading(false) }
  }

  useEffect(() => { refresh() }, [connectionId, range])
  useEffect(() => { ++analysisRequest.current; setAnalyzing(false); setRecommendations([]) }, [connectionId, range])

  useEffect(() => {
    const token = params.get('google_pending')
    if (params.get('google_error')) toast.error('Falha ao conectar Google', 'Confira o acesso à API, o URI de redirecionamento e as permissões da conta.')
    if (!token) {
      if (params.get('google_error')) setParams(previous => { const next = new URLSearchParams(previous); next.delete('google_error'); return next }, { replace: true })
      return
    }
    api.get(`/google/pending/${token}`).then(({ data }) => {
      setPendingToken(token)
      setPendingOptions(data.options)
      setPendingKind(data.kind)
      setSelectedOption(data.options[0]?.id || '')
      setClientId(data.clientId)
      setKind(data.kind)
    }).catch(error => toast.error('Seleção Google expirada', getErrorMessage(error)))
      .finally(() => setParams(previous => { const next = new URLSearchParams(previous); next.delete('google_pending'); next.delete('google_error'); return next }, { replace: true }))
  }, [])

  const connect = async () => {
    if (!clientId) return
    setConnecting(true)
    try {
      const { data } = await api.get('/google/connect', { params: { clientId, kind } })
      window.location.assign(data.authUrl)
    } catch (error) { toast.error('Erro ao iniciar ligação Google', getErrorMessage(error)); setConnecting(false) }
  }

  const analyze = async () => {
    if (!connectionId) return
    const request = ++analysisRequest.current
    setAnalyzing(true)
    try {
      const { data } = await api.post(`/google/connections/${connectionId}/analyze`, { range })
      if (request === analysisRequest.current) {
        setRecommendations(data.recommendations || [])
        if (!data.recommendations?.length) toast.info('Sem ações recomendadas', 'Os dados deste período não justificam uma mudança específica.')
      }
    } catch (error) { if (request === analysisRequest.current) toast.error('Erro ao analisar com Brand Brain', getErrorMessage(error)) }
    finally { if (request === analysisRequest.current) setAnalyzing(false) }
  }

  const confirm = async () => {
    if (!selectedOption) return
    setConfirming(true)
    try {
      const { data } = await api.post(`/google/pending/${pendingToken}/confirm`, { optionId: selectedOption })
      setPendingToken('')
      setKind(pendingKind)
      await loadConnections(clientId)
      setConnectionId(data.id)
      toast.success('Conta Google conectada ao cliente')
    } catch (error) { toast.error('Erro ao conectar conta', getErrorMessage(error)) }
    finally { setConfirming(false) }
  }

  const disconnect = async () => {
    if (!selectedConnection) return
    if (!await confirmDialog({ title: 'Desconectar conta Google?', description: `Remover ${selectedConnection.name} deste cliente?`, confirmLabel: 'Desconectar', variant: 'destructive' })) return
    try {
      await api.delete(`/google/connections/${selectedConnection.id}`)
      setConnectionId('')
      setInsights(null)
      await loadConnections(clientId)
      toast.success('Conta desconectada')
    } catch (error) { toast.error('Erro ao desconectar', getErrorMessage(error)) }
  }

  const changeCampaignStatus = async (campaign: any) => {
    if (!selectedConnection) return
    const nextStatus = campaign.status === 'ENABLED' ? 'PAUSED' : 'ENABLED'
    const label = nextStatus === 'PAUSED' ? 'Pausar' : 'Reativar'
    if (!await confirmDialog({ title: `${label} “${campaign.name}”?`, description: 'Isso muda de verdade o status da campanha no Google Ads.', confirmLabel: label, variant: label === 'Pausar' ? 'destructive' : 'default' })) return
    setChangingCampaignId(campaign.id)
    try {
      await api.post(`/google/connections/${selectedConnection.id}/campaigns/${campaign.id}/status`, { status: nextStatus })
      if (selectedConnectionRef.current === selectedConnection.id) await refresh()
      toast.success(`Campanha ${nextStatus === 'PAUSED' ? 'pausada' : 'reativada'}`)
    } catch (error) { toast.error(`Erro ao ${label.toLowerCase()} campanha`, getErrorMessage(error)) }
    finally { setChangingCampaignId('') }
  }

  return <Page>
    <PageHeader icon={<PageIcon><BrandIcon platform={kind === 'ads' ? 'GOOGLE_ADS' : 'GOOGLE_ANALYTICS'} size={22} /></PageIcon>} title="Google Ads & Analytics" description="Campanhas e desempenho dos websites dos clientes, com dados diretos do Google." />

    <div className="flex flex-wrap gap-2 border-b border-border pb-3">
      <Button variant={kind === 'ads' ? 'solid' : 'subtle'} onClick={() => setKind('ads')}><BrandIcon platform="GOOGLE_ADS" colored={kind !== 'ads'} size={16} />Google Ads</Button>
      <Button variant={kind === 'analytics' ? 'solid' : 'subtle'} onClick={() => setKind('analytics')}><BrandIcon platform="GOOGLE_ANALYTICS" colored={kind !== 'analytics'} size={16} />Analytics (GA4)</Button>
    </div>

    {loadError && <Card className="p-4 sm:p-5 border-error/30">
      <p className="text-sm font-semibold text-foreground">Não foi possível carregar todos os dados da página.</p>
      <p className="mt-1 text-sm text-muted-foreground break-words">{loadError}</p>
      <Button variant="subtle" className="mt-3" onClick={() => setReloadKey(value => value + 1)}>Tentar novamente</Button>
    </Card>}

    {settings && <Card className={`p-5 ${settings.configured ? '' : 'border-primary/30'}`}>
      <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">{settings.configured ? 'Google Cloud configurado' : 'Configure o Google Cloud da agência'}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{settings.configured ? 'Para conectar Ads ou GA4, confirme que o projeto tem acesso às APIs Google Ads, Analytics Data e Analytics Admin e que este URI está autorizado:' : 'Adicione o Client ID e o Client Secret em Redes Sociais → Agência → YouTube. Ative as APIs Google Ads, Analytics Data e Analytics Admin no mesmo projeto e registe este URI de redirecionamento:'}</p>
      <code className="mt-3 block rounded-lg bg-muted p-3 text-xs text-foreground break-all">{settings.callbackUrl}</code>
      <Link to="/app/social" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Abrir configurações <ExternalLink size={14} /></Link>
    </Card>}

    <Card className="p-4 sm:p-5">
      <div className={`grid gap-3 sm:grid-cols-2 lg:items-end ${canManage ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]' : ''}`}>
        <div className="min-w-0"><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Cliente</label>
          <Select value={clientId} onValueChange={setClientId}><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
            <SelectContent>{clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-0"><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{kind === 'ads' ? 'Conta Google Ads' : 'Propriedade GA4'}</label>
          <Select value={connectionId || undefined} onValueChange={setConnectionId} disabled={!visibleConnections.length}><SelectTrigger><SelectValue placeholder={visibleConnections.length ? 'Selecione a conta' : 'Nenhuma conta conectada'} /></SelectTrigger>
            <SelectContent>{visibleConnections.map(connection => <SelectItem key={connection.id} value={connection.id}>{connection.name}</SelectItem>)}</SelectContent></Select></div>
        {canManage && <Button onClick={connect} loading={connecting} disabled={!clientId || !settings?.configured} className="w-full lg:w-auto"><Plus size={16} />Conectar {kind === 'ads' ? 'Google Ads' : 'GA4'}</Button>}
      </div>
      {selectedConnection && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <span className="min-w-0 break-all">ID {selectedConnection.externalId} · {selectedConnection.name}</span>
        {canManage && <button onClick={disconnect} className="inline-flex items-center gap-1 text-muted-foreground hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"><Trash2 size={14} />Desconectar</button>}
      </div>}
    </Card>

    {selectedConnection ? <>
      <div className="flex flex-wrap items-center justify-between gap-3">
<Segmented
          value={range}
          onChange={setRange}
          label="Período"
          options={[{ value: 'today', label: 'Hoje' }, { value: '7d', label: '7 dias' }, { value: '30d', label: '30 dias' }]}
        />
        <Button variant="outline" size="sm" onClick={refresh} loading={loading} aria-label="Atualizar dados" title="Atualizar dados">{!loading && <RefreshCw size={15} />}<span className="hidden sm:inline">Atualizar</span></Button>
      </div>

      {loading && !insights ? <div aria-busy="true" aria-label="Carregando dados do Google" className="space-y-5"><div className="grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-border/70 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-none" />)}</div><Skeleton className="h-64 rounded-[20px]" /></div> : insights?.kind === 'ads' ? <>
        <MetricExplorer
          tiles={[
            { key: 'spend', label: 'Investimento', value: money(insights.totals.spend, insights.currency), icon: TrendingUp, chart: { color: '#00A76F', pick: (r) => Number(r.spend || 0) } },
            { key: 'impressions', label: 'Impressões', value: number(insights.totals.impressions), icon: Globe2, chart: { color: '#00B8D9', pick: (r) => Number(r.impressions || 0) } },
            { key: 'clicks', label: 'Cliques', value: number(insights.totals.clicks), icon: MousePointerClick, chart: { color: '#8E33FF', pick: (r) => Number(r.clicks || 0) } },
            { key: 'ctr', label: 'CTR', value: percent(insights.totals.ctr), icon: BarChart3 },
            { key: 'cpc', label: 'CPC', value: money(insights.totals.cpc, insights.currency), icon: MousePointerClick },
            { key: 'conversions', label: 'Conversões', value: number(insights.totals.conversions), icon: Users, chart: { color: '#FFAB00', pick: (r) => Number(r.conversions || 0) } },
            { key: 'cpa', label: 'Custo/conversão', value: money(insights.totals.costPerConversion, insights.currency), icon: TrendingUp },
          ]}
          rows={insights.daily || []}
          labelOf={dayLabel}
          tooltipOf={dayTooltip}
          caption="Por dia"
          empty="Sem dados diários neste período."
        />
        <Card className="p-4 sm:p-5 min-w-0"><h2 className="mb-4 text-base font-semibold text-foreground">Campanhas</h2>
          {insights.campaigns.length > 0 && <FilterBar
            className="mb-4"
            pills={[
              { key: 'all', label: 'Todas', count: insights.campaigns.length },
              { key: 'ENABLED', label: 'Ativas', count: insights.campaigns.filter((c: any) => c.status === 'ENABLED').length },
              { key: 'PAUSED', label: 'Pausadas', count: insights.campaigns.filter((c: any) => c.status === 'PAUSED').length },
            ]}
            value={statusTab}
            onChange={setStatusTab}
            query={campaignQuery}
            onQuery={setCampaignQuery}
            placeholder="Pesquisar campanha"
            label="Filtrar campanhas por estado"
          />}
          {/* Phones: cards instead of a sideways-scrolling table */}
          <ul className="divide-y divide-border/70 md:hidden">
            {insights.campaigns.filter((c: any) => (statusTab === 'all' || c.status === statusTab) && (!campaignQuery.trim() || String(c.name || '').toLowerCase().includes(campaignQuery.trim().toLowerCase()))).map((campaign: any) => (
              <li key={campaign.id} className="py-3.5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-[13px] font-semibold leading-snug text-foreground">{campaign.name}</p>
                    <Badge dot variant={campaign.status === 'ENABLED' ? 'success' : 'default'} className="mt-1.5 text-[11px]">{GOOGLE_STATUS[campaign.status] || campaign.status}</Badge>
                  </div>
                  {canManage && (campaign.status === 'ENABLED' || campaign.status === 'PAUSED') && (
                    <Button type="button" variant="outline" size="sm" disabled={!!changingCampaignId} onClick={() => changeCampaignStatus(campaign)}
                      aria-label={campaign.status === 'ENABLED' ? 'Pausar campanha' : 'Reativar campanha'} className="size-9 shrink-0 p-0">
                      {campaign.status === 'ENABLED' ? <Pause size={14} /> : <Play size={14} />}
                    </Button>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2.5 text-center">
                  <div><dt className="text-[11px] text-muted-foreground">Gasto</dt><dd className="mt-0.5 truncate text-[13px] font-semibold tabular-nums">{money(campaign.spend, insights.currency)}</dd></div>
                  <div><dt className="text-[11px] text-muted-foreground">Cliques</dt><dd className="mt-0.5 text-[13px] font-semibold tabular-nums">{number(campaign.clicks)}</dd></div>
                  <div><dt className="text-[11px] text-muted-foreground">Conversões</dt><dd className="mt-0.5 text-[13px] font-semibold tabular-nums">{number(campaign.conversions)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[780px] text-sm"><thead><tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="pb-3 pr-4">Campanha</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4 text-right">Gasto</th><th className="pb-3 pr-4 text-right">Cliques</th><th className="pb-3 pr-4 text-right">Impressões</th><th className="pb-3 pr-4 text-right">Conversões</th>{canManage && <th className="pb-3 text-right">Ação</th>}
          </tr></thead><tbody>{insights.campaigns.filter((c: any) => (statusTab === 'all' || c.status === statusTab) && (!campaignQuery.trim() || String(c.name || '').toLowerCase().includes(campaignQuery.trim().toLowerCase()))).map((campaign: any) => <tr key={campaign.id} className="border-b border-border/60 last:border-0 text-foreground">
            <td className="py-3 pr-4 font-semibold">{campaign.name}</td><td className="py-3 pr-4"><Badge dot variant={campaign.status === 'ENABLED' ? 'success' : 'default'} className="text-[11px]">{GOOGLE_STATUS[campaign.status] || campaign.status}</Badge></td><td className="py-3 pr-4 text-right font-semibold tabular-nums">{money(campaign.spend, insights.currency)}</td><td className="py-3 pr-4 text-right">{number(campaign.clicks)}</td><td className="py-3 pr-4 text-right">{number(campaign.impressions)}</td><td className="py-3 pr-4 text-right">{number(campaign.conversions)}</td>{canManage && <td className="py-3 text-right">
              {(campaign.status === 'ENABLED' || campaign.status === 'PAUSED') && <button disabled={!!changingCampaignId} onClick={() => changeCampaignStatus(campaign)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                {campaign.status === 'ENABLED' ? <Pause size={12} /> : <Play size={12} />}{changingCampaignId === campaign.id ? 'Aguarde…' : campaign.status === 'ENABLED' ? 'Pausar' : 'Reativar'}
              </button>}
            </td>}
          </tr>)}</tbody></table>{!insights.campaigns.length && <p className="py-6 text-sm text-muted-foreground">Sem campanhas neste período.</p>}</div>
        </Card>
      </> : insights?.kind === 'analytics' ? <>
        <MetricExplorer
          tiles={[
            { key: 'users', label: 'Usuários', value: number(insights.totals.users), icon: Users },
            { key: 'sessions', label: 'Sessões', value: number(insights.totals.sessions), icon: Globe2, chart: { color: '#00A76F', pick: (r) => Number(r.sessions || 0) } },
            { key: 'views', label: 'Visualizações', value: number(insights.totals.views), icon: BarChart3, chart: { color: '#8E33FF', pick: (r) => Number(r.views || 0) } },
            { key: 'engaged', label: 'Sessões envolvidas', value: number(insights.totals.engagedSessions), icon: MousePointerClick },
            { key: 'rate', label: 'Taxa de envolvimento', value: percent(insights.totals.engagementRate * 100), icon: TrendingUp },
            { key: 'keyEvents', label: 'Eventos principais', value: number(insights.totals.keyEvents), icon: BarChart3 },
          ]}
          rows={insights.daily || []}
          labelOf={dayLabel}
          tooltipOf={dayTooltip}
          caption="Por dia"
          empty="Sem dados diários neste período."
        />
        <div className="grid gap-4 lg:grid-cols-3"><Breakdown title="Páginas mais vistas" rows={insights.pages} valueKey="views" />
          <Breakdown title="Origem do tráfego" rows={insights.channels} valueKey="sessions" />
          <Breakdown title="Países" rows={insights.countries} valueKey="sessions" /></div>
      </> : null}
      {insights && <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">Recomendações do Brand Brain</h2>
            <p className="mt-1 text-xs text-muted-foreground">Sugestões baseadas nas métricas atuais. Reveja antes de agir.</p></div>
          {canManage && <Button onClick={analyze} loading={analyzing} className="w-full sm:w-auto"><Sparkles size={15} />Analisar com Brand Brain</Button>}
        </div>
        {recommendations.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2">{recommendations.map((item, index) => <div key={`${item.targetId}-${index}`} className="rounded-xl border border-border bg-muted/30 p-4 min-w-0">
          <p className="text-xs font-semibold text-primary break-words">{item.targetName}</p>
          <h3 className="mt-1 text-sm font-bold text-foreground break-words">{item.action}</h3>
          <p className="mt-2 text-sm text-muted-foreground break-words">{item.reasoning}</p>
          <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground break-words">Dados verificados: {item.evidence}</p>
        </div>)}</div>}
      </Card>}
    </> : <Card className="p-8 text-center"><BrandIcon platform={kind === 'ads' ? 'GOOGLE_ADS' : 'GOOGLE_ANALYTICS'} className="mx-auto mb-3" size={28} />
      <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">{kind === 'ads' ? 'Conecte uma conta Google Ads' : 'Conecte uma propriedade GA4'}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Escolha o cliente acima para consultar as métricas desta conta.</p></Card>}

    <Dialog open={!!pendingToken} onOpenChange={open => { if (!open) setPendingToken('') }}>
      <DialogContent size="lg"><DialogHeader><DialogTitle>Escolher {pendingKind === 'ads' ? 'conta Google Ads' : 'propriedade Analytics'}</DialogTitle>
        <DialogDescription>Associe ao cliente apenas a conta que lhe pertence.</DialogDescription></DialogHeader>
        <Select value={selectedOption || undefined} onValueChange={setSelectedOption}><SelectTrigger><SelectValue placeholder="Escolha uma conta" /></SelectTrigger>
          <SelectContent>{pendingOptions.map(option => <SelectItem key={`${option.id}-${option.loginCustomerId || ''}`} value={option.id}>{option.name} ({option.id})</SelectItem>)}</SelectContent></Select>
        <DialogFooter><Button onClick={confirm} loading={confirming} disabled={!selectedOption}>Conectar conta</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </Page>
}
