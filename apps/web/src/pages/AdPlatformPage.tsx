import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BarChart3, ExternalLink, Eye, MousePointerClick, Plus, RefreshCw, Trash2, TrendingUp, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { brandIcon } from '@/components/brand/BrandIcon'
import api from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Page, PageHeader, PageIcon } from '@/components/layout/Page'
import { Stat, StatGroup } from '@/components/ui/Stat'

const TikTokAdsIcon = brandIcon('TIKTOK_ADS')
const LinkedInAdsIcon = brandIcon('LINKEDIN_ADS')

type Platform = 'tiktok' | 'linkedin'
type Range = 'today' | '7d' | '30d'
type Client = { id: string; name: string }
type Connection = { id: string; name: string; externalId: string; currency: string | null; status: string }
type Option = { id: string; name: string; currency: string | null }
type Campaign = { id: string; name: string; status: string; spend: number; impressions: number; clicks: number; conversions: number }
type Insights = { range: Range; currency: string | null; totals: { spend: number; impressions: number; clicks: number; conversions: number; ctr: number; cpc: number }; campaigns: Campaign[] }
type Settings = { configured: boolean; callbackUrl: string; setup: string; requiredAccess: string }

const count = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value || 0)
const money = (value: number, currency: string | null) => {
  if (!currency) return `${count(value)} · moeda não identificada`
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value || 0) }
  catch { return `${count(value)} ${currency}` }
}
const percent = (value: number) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value || 0)}%`

function Metric({ label, value, icon }: { label: string; value: string; icon: LucideIcon }) {
  return <Stat label={label} value={value} icon={icon} />
}

export function AdPlatformPage({ platform }: { platform: Platform }) {
  const isTikTok = platform === 'tiktok'
  const name = isTikTok ? 'TikTok Ads' : 'LinkedIn Ads'
  const Icon = isTikTok ? TikTokAdsIcon : LinkedInAdsIcon
  const role = useAuthStore(state => state.user?.role)
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER'
  const [params, setParams] = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionId, setConnectionId] = useState('')
  const [range, setRange] = useState<Range>('7d')
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [initialError, setInitialError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [pendingToken, setPendingToken] = useState('')
  const [pendingOptions, setPendingOptions] = useState<Option[]>([])
  const [selectedOption, setSelectedOption] = useState('')
  const [confirming, setConfirming] = useState(false)
  const connectionRequest = useRef(0)
  const insightRequest = useRef(0)
  const selectedConnection = connections.find(connection => connection.id === connectionId)

  const loadConnections = async (id: string) => {
    const request = ++connectionRequest.current
    const { data } = await api.get<Connection[]>(`/ad-platforms/${platform}/connections`, { params: { clientId: id } })
    if (request === connectionRequest.current) setConnections(data)
  }
  const loadInsights = async (id: string, selectedRange: Range) => {
    const request = ++insightRequest.current
    setInsights(null)
    if (!id) { setLoading(false); setLoadError(''); return }
    setLoading(true)
    setLoadError('')
    try {
      const { data } = await api.get<Insights>(`/ad-platforms/${platform}/connections/${id}/insights`, { params: { range: selectedRange } })
      if (request === insightRequest.current) setInsights(data)
    } catch (error) { if (request === insightRequest.current) setLoadError(getErrorMessage(error)) }
    finally { if (request === insightRequest.current) setLoading(false) }
  }

  useEffect(() => {
    let active = true
    const fetchClients = async (): Promise<Client[]> => {
      const { data: first } = await api.get<{ data: Client[]; total: number }>('/clients', { params: { limit: 200 } })
      const pages = Math.ceil(first.total / 200)
      if (pages <= 1) return first.data
      const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) =>
        api.get<{ data: Client[] }>('/clients', { params: { limit: 200, page: index + 2 } })))
      return [...first.data, ...rest.flatMap(response => response.data.data)]
    }
    Promise.allSettled([fetchClients(), api.get<Settings>(`/ad-platforms/${platform}/settings`)]).then(([clientsResult, settingsResult]) => {
      if (!active) return
      if (clientsResult.status === 'fulfilled') {
        const list = clientsResult.value
        setClients(list)
        const preferred = params.get('clientId')
        setClientId(current => current || list.find((client: Client) => client.id === preferred)?.id || list[0]?.id || '')
      } else setInitialError(getErrorMessage(clientsResult.reason))
      if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value.data)
      else setInitialError(previous => [previous, getErrorMessage(settingsResult.reason)].filter(Boolean).join(' · '))
    })
    return () => { active = false }
  }, [platform])

  useEffect(() => {
    setConnections([])
    setConnectionId('')
    setInsights(null)
    if (clientId) loadConnections(clientId).catch(error => setLoadError(getErrorMessage(error)))
  }, [platform, clientId])
  useEffect(() => {
    if (!connections.some(connection => connection.id === connectionId)) setConnectionId(connections[0]?.id || '')
  }, [connections, connectionId])
  useEffect(() => { void loadInsights(connectionId, range) }, [connectionId, range, platform])

  useEffect(() => {
    const token = params.get('ads_pending')
    if (params.get('ads_error')) toast.error(`Não foi possível conectar ${name}`, 'Confirme o callback, a aprovação da API e o acesso à conta de anúncios.')
    if (token) api.get(`/ad-platforms/${platform}/pending/${token}`).then(({ data }) => {
      setPendingToken(token)
      setPendingOptions(data.options)
      setSelectedOption(data.options[0]?.id || '')
      setClientId(data.clientId)
    }).catch(error => toast.error('Seleção expirada', getErrorMessage(error)))
    if (token || params.get('ads_error')) setParams(previous => {
      const next = new URLSearchParams(previous)
      next.delete('ads_pending'); next.delete('ads_error')
      return next
    }, { replace: true })
  }, [platform])

  const connect = async () => {
    if (!clientId) return
    setConnecting(true)
    try {
      const { data } = await api.get(`/ad-platforms/${platform}/connect`, { params: { clientId } })
      window.location.assign(data.authUrl)
    } catch (error) { toast.error(`Erro ao conectar ${name}`, getErrorMessage(error)); setConnecting(false) }
  }
  const confirm = async () => {
    if (!pendingToken || !selectedOption) return
    setConfirming(true)
    try {
      const { data } = await api.post(`/ad-platforms/${platform}/pending/${pendingToken}/confirm`, { optionId: selectedOption })
      setPendingToken('')
      await loadConnections(data.clientId)
      setConnectionId(data.id)
      toast.success(`Conta ${name} conectada`)
    } catch (error) { toast.error('Erro ao conectar conta', getErrorMessage(error)) }
    finally { setConfirming(false) }
  }
  const disconnect = async () => {
    if (!selectedConnection) return
    if (!await confirmDialog({ title: `Desconectar ${name}?`, description: `Remover ${selectedConnection.name} deste cliente?`, confirmLabel: 'Desconectar', variant: 'destructive' })) return
    try {
      await api.delete(`/ad-platforms/${platform}/connections/${selectedConnection.id}`)
      setConnectionId(''); setInsights(null)
      await loadConnections(clientId)
      toast.success('Conta desconectada')
    } catch (error) { toast.error('Erro ao desconectar', getErrorMessage(error)) }
  }

  return <Page>
    <PageHeader icon={<PageIcon><Icon size={22} /></PageIcon>} title={name} description="Campanhas e resultados diretos da conta de anúncios de cada cliente." />

    {initialError && <Card className="border-error/30 p-4 text-sm text-foreground" role="alert">Não foi possível carregar a configuração: {initialError}</Card>}
    {settings && <Card className={`p-4 sm:p-5 ${settings.configured ? '' : 'border-primary/30'}`}><h2 className="text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">{settings.configured ? 'Aplicação configurada' : `Configure a aplicação ${name}`}</h2><p className="mt-1 text-sm text-muted-foreground">{settings.setup}. A aplicação precisa de {settings.requiredAccess}.</p><p className="mt-3 text-xs font-semibold text-muted-foreground">Callback a registar na aplicação:</p><code className="mt-1 block break-all rounded-lg bg-muted p-3 text-xs text-foreground">{settings.callbackUrl}</code>{!settings.configured && <Link to="/app/social" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Abrir Redes sociais › Agência <ExternalLink size={14} /></Link>}</Card>}

    <Card className="p-4 sm:p-5"><div className={`grid gap-3 sm:grid-cols-2 lg:items-end ${canManage ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]' : ''}`}><div className="min-w-0"><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Cliente</label><Select value={clientId} onValueChange={setClientId}><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent>{clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div><div className="min-w-0"><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Conta {name}</label><Select value={connectionId || undefined} onValueChange={setConnectionId} disabled={!connections.length}><SelectTrigger><SelectValue placeholder={connections.length ? 'Selecione a conta' : 'Nenhuma conta conectada'} /></SelectTrigger><SelectContent>{connections.map(connection => <SelectItem key={connection.id} value={connection.id}>{connection.name}</SelectItem>)}</SelectContent></Select></div>{canManage && <Button onClick={connect} loading={connecting} disabled={!clientId || !settings?.configured} className="w-full lg:w-auto"><Plus size={16} />Conectar {name}</Button>}</div>{selectedConnection && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><span className="min-w-0 break-all">ID {selectedConnection.externalId} · {selectedConnection.name}</span>{canManage && <button onClick={disconnect} className="inline-flex items-center gap-1 rounded text-muted-foreground hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><Trash2 size={14} />Desconectar</button>}</div>}</Card>

    {selectedConnection ? <><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1">{([['today', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias']] as const).map(([value, label]) => <button key={value} onClick={() => setRange(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${range === value ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{label}</button>)}</div><Button variant="subtle" onClick={() => void loadInsights(connectionId, range)} loading={loading}><RefreshCw size={15} />Atualizar</Button></div>
      {loadError && <Card className="border-error/30 p-4" role="alert"><p className="text-sm font-semibold text-foreground">Não foi possível ler esta conta.</p><p className="mt-1 break-words text-sm text-muted-foreground">{loadError}</p></Card>}
      {loading && !insights ? <Card className="p-8 text-sm text-muted-foreground">Carregando dados de {name}…</Card> : insights && <><StatGroup className="lg:grid-cols-3 xl:grid-cols-6"><Metric label="Investimento" value={money(insights.totals.spend, insights.currency)} icon={Wallet} /><Metric label="Impressões" value={count(insights.totals.impressions)} icon={Eye} /><Metric label="Cliques" value={count(insights.totals.clicks)} icon={MousePointerClick} /><Metric label="CTR" value={percent(insights.totals.ctr)} icon={BarChart3} /><Metric label="Conversões" value={count(insights.totals.conversions)} icon={Users} /><Metric label="Custo/conversão" value={insights.totals.conversions ? money(insights.totals.spend / insights.totals.conversions, insights.currency) : '—'} icon={TrendingUp} /></StatGroup>
        <Card className="min-w-0 p-4 sm:p-5"><h2 className="mb-4 font-bold text-foreground">Campanhas</h2><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="pb-3 pr-4">Campanha</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4 text-right">Gasto</th><th className="pb-3 pr-4 text-right">Cliques</th><th className="pb-3 pr-4 text-right">Impressões</th><th className="pb-3 text-right">Conversões</th></tr></thead><tbody>{insights.campaigns.map(campaign => <tr key={campaign.id} className="border-b border-border/60 last:border-0 text-foreground"><td className="py-3 pr-4 font-semibold">{campaign.name}</td><td className="py-3 pr-4 text-xs text-muted-foreground">{campaign.status || '—'}</td><td className="py-3 pr-4 text-right">{money(campaign.spend, insights.currency)}</td><td className="py-3 pr-4 text-right">{count(campaign.clicks)}</td><td className="py-3 pr-4 text-right">{count(campaign.impressions)}</td><td className="py-3 text-right">{count(campaign.conversions)}</td></tr>)}</tbody></table>{!insights.campaigns.length && <p className="py-6 text-sm text-muted-foreground">Sem atividade de campanhas neste período.</p>}</div></Card><p className="text-xs text-muted-foreground">Conversões seguem o evento atribuído pela própria plataforma; podem não representar contactos ou leads.</p></>}
    </> : <Card className="p-8 text-center"><Icon className="mx-auto mb-3 text-foreground" size={28} /><h2 className="text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">Conecte uma conta {name}</h2><p className="mt-1 text-sm text-muted-foreground">Escolha um cliente e autorize a conta de anúncios para ver dados reais.</p></Card>}

    <Dialog open={!!pendingToken} onOpenChange={open => { if (!open) setPendingToken('') }}><DialogContent size="lg"><DialogHeader><DialogTitle>Escolher conta {name}</DialogTitle><DialogDescription>Associe ao cliente apenas a conta que lhe pertence.</DialogDescription></DialogHeader><Select value={selectedOption || undefined} onValueChange={setSelectedOption}><SelectTrigger><SelectValue placeholder="Escolha uma conta" /></SelectTrigger><SelectContent>{pendingOptions.map(option => <SelectItem key={option.id} value={option.id}>{option.name} ({option.id})</SelectItem>)}</SelectContent></Select><DialogFooter><Button onClick={confirm} loading={confirming} disabled={!selectedOption}>Conectar conta</Button></DialogFooter></DialogContent></Dialog>
  </Page>
}
