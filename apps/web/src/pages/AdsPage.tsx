import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Info, Megaphone, Plus, RefreshCw, Sparkles, TrendingUp, TrendingDown, Eye as EyeIcon,
  MousePointerClick, Wallet, Target, Check, X, Trash2, Loader2, Pause, Play,
  MapPin, Users, MessageCircle, Radio,
} from 'lucide-react'
import { BrandIcon } from '@/components/brand/BrandIcon'
import api, { cachedGet } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'
import { Page, PageHeader, PageIcon } from '@/components/layout/Page'
import { Stat, StatGroup } from '@/components/ui/Stat'
import { AudienceBreakdown, type AudienceSegment } from '@/components/ads/AudienceBreakdown'
import { CampaignCreativePreview } from '@/components/ads/CampaignCreativePreview'
import { MetricExplorer } from '@/components/charts/MetricExplorer'
import { FilterBar } from '@/components/ui/FilterPills'
import { Segmented } from '@/components/dashboard/DashboardWidgets'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ACTION_LABELS: Record<string, { label: string; variant: 'error' | 'success' | 'warning' | 'default' }> = {
  PAUSE: { label: 'Pausar', variant: 'error' },
  INCREASE_BUDGET: { label: 'Aumentar orçamento', variant: 'success' },
  DECREASE_BUDGET: { label: 'Reduzir orçamento', variant: 'warning' },
  ADVISORY: { label: 'Revisar', variant: 'default' },
}

function formatCurrency(value: number, currency?: string | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value || 0)
}

type Segment = AudienceSegment
type AudienceInsights = {
  regions: Segment[]; demographics: Segment[]; placements: Segment[]
  contacts: number; linkClicks: number; contactRate: number | null
  reach: number | null; frequency: number | null
}

const AD_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativa', PAUSED: 'Pausada', DISABLED: 'Desativada', ARCHIVED: 'Arquivada', DELETED: 'Excluída',
  CAMPAIGN_PAUSED: 'Campanha pausada', ADSET_PAUSED: 'Conjunto pausado', IN_PROCESS: 'Em análise', WITH_ISSUES: 'Com problemas',
}

// KPI tiles that can drive the chart, by label.
const CHARTABLE: Record<string, { color: string; pick: (row: Record<string, string | number>) => number }> = {
  'Investimento': { color: '#00A76F', pick: (r) => Number(r.spend || 0) },
  'Impressões': { color: '#00B8D9', pick: (r) => Number(r.impressions || 0) },
  'Cliques': { color: '#8E33FF', pick: (r) => Number(r.clicks || 0) },
  'Resultados': { color: '#FFAB00', pick: (r) => Number(r.results || 0) },
}

export function AdsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [clients, setClients] = useState<any[]>([])
  const [clientId, setClientId] = useState('')
  const [loadingClients, setLoadingClients] = useState(true)

  const [accounts, setAccounts] = useState<any[]>([])
  const [accountId, setAccountId] = useState('')
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')
  // '' = every campaign blended together (the original behavior). An account with more than one
  // campaign delivering at very different scales made the top KPI cards read as "wrong" — one
  // campaign's CPC blended with a barely-spending one doesn't match what Meta's own app shows for
  // either campaign individually, and nothing on the page said which campaign a number belonged
  // to. This scopes the cards (and, below, the AI analysis) to one campaign at a time.
  const [campaignFilter, setCampaignFilter] = useState('')
  const [statusTab, setStatusTab] = useState<'all' | 'ACTIVE' | 'PAUSED'>('all')
  const [campaignQuery, setCampaignQuery] = useState('')
  const [insights, setInsights] = useState<any>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [audience, setAudience] = useState<AudienceInsights | null>(null)
  const [loadingAudience, setLoadingAudience] = useState(false)
  const [audienceError, setAudienceError] = useState(false)
  const [audienceVersion, setAudienceVersion] = useState(0)

  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [actingOnId, setActingOnId] = useState<string | null>(null)
  const [togglingCampaignId, setTogglingCampaignId] = useState<string | null>(null)

  // Account picker — shown when the agency's Meta user has access to more than one ad account.
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [pendingAccounts, setPendingAccounts] = useState<any[]>([])
  const [pendingClientId, setPendingClientId] = useState('')
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [confirmingPending, setConfirmingPending] = useState(false)

  const account = accounts.find((a) => a.id === accountId)

  useEffect(() => {
    async function load() {
      try {
        // Open on a client that actually has a Meta ad account, not just the first one alphabetically.
        const [{ data }, withAccounts] = await Promise.all([
          cachedGet('/clients'),
          cachedGet('/ads/accounts').then((r) => r.data as { clientId: string }[]).catch(() => []),
        ])
        const list = data.data || []
        setClients(list)
        const preferred = list.find((c: any) => withAccounts.some((a) => a.clientId === c.id)) || list[0]
        if (preferred) setClientId((current) => current || preferred.id)
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingClients(false)
      }
    }
    load()
  }, [])

  const loadAccounts = async (cid: string) => {
    setLoadingAccounts(true)
    try {
      const { data } = await cachedGet('/ads/accounts', { params: { clientId: cid } })
      setAccounts(data || [])
      setAccountId(data?.[0]?.id || '')
      if (!data?.length) { setInsights(null); setRecommendations([]) }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAccounts(false)
    }
  }

  useEffect(() => {
    if (clientId) loadAccounts(clientId)
  }, [clientId])

  const loadInsights = async (id: string, r: 'today' | '7d' | '30d', campaignExternalId?: string) => {
    setLoadingInsights(true)
    try {
      const { data } = await cachedGet(`/ads/accounts/${id}/insights`, {
        params: { range: r, ...(campaignExternalId ? { campaignExternalId } : {}) },
      })
      setInsights(data)
    } catch (err) {
      toast.error('Erro ao carregar métricas', getErrorMessage(err))
    } finally {
      setLoadingInsights(false)
    }
  }

  const loadRecommendations = async (id: string) => {
    setLoadingRecs(true)
    try {
      const { data } = await cachedGet('/ads/recommendations', { params: { connectionId: id } })
      setRecommendations(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingRecs(false)
    }
  }

  // Selecting a different account starts back at "all campaigns" — a campaign id from one
  // account means nothing once you've switched to another account's data.
  useEffect(() => {
    setCampaignFilter('')
  }, [accountId])

  useEffect(() => {
    if (accountId) {
      loadInsights(accountId, range, campaignFilter || undefined)
      loadRecommendations(accountId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, range, campaignFilter])

  useEffect(() => {
    if (insights && campaignFilter && !insights.campaigns?.some((c: any) => c.campaignExternalId === campaignFilter)) {
      setCampaignFilter('')
    }
  }, [insights, campaignFilter])

  useEffect(() => {
    if (!accountId) { setAudience(null); return }
    let cancelled = false
    setAudience(null)
    setAudienceError(false)
    setLoadingAudience(true)
    cachedGet(`/ads/accounts/${accountId}/audience`, {
      params: { range, ...(campaignFilter ? { campaignExternalId: campaignFilter } : {}) },
    }).then(({ data }) => {
      if (!cancelled) setAudience(data)
    }).catch(() => {
      if (!cancelled) setAudienceError(true)
    }).finally(() => {
      if (!cancelled) setLoadingAudience(false)
    })
    return () => { cancelled = true }
  }, [accountId, range, campaignFilter, audienceVersion])

  // Land back here after the Meta OAuth redirect and show the result.
  useEffect(() => {
    if (searchParams.get('ads_connected')) {
      const cid = searchParams.get('clientId')
      if (cid) { setClientId(cid); loadAccounts(cid) }
      toast.success('Conta de anúncios conectada com sucesso!')
      setSearchParams({}, { replace: true })
    } else if (searchParams.get('ads_select_account')) {
      const token = searchParams.get('token')
      const cid = searchParams.get('clientId')
      if (cid) setClientId(cid)
      if (token) loadPendingAccounts(token)
      setSearchParams({}, { replace: true })
    } else if (searchParams.get('ads_error')) {
      const reason = searchParams.get('reason')
      toast.error(
        'Não foi possível conectar a conta',
        reason === 'no_accounts' ? 'Nenhuma conta de anúncios foi encontrada para esse login da Meta.' : 'Tente novamente.'
      )
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const loadPendingAccounts = async (token: string) => {
    setLoadingPending(true)
    try {
      const { data } = await api.get(`/ads/meta/pending/${token}`)
      setPendingAccounts(data.accounts || [])
      setSelectedPendingIds([])
      setPendingClientId(data.clientId)
      setPendingToken(token)
    } catch (err) {
      toast.error('Não foi possível carregar as contas', getErrorMessage(err, 'Tente conectar novamente.'))
    } finally {
      setLoadingPending(false)
    }
  }

  const togglePendingSelection = (id: string) => {
    setSelectedPendingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleConfirmPendingSelection = async () => {
    if (!pendingToken || selectedPendingIds.length === 0) return
    setConfirmingPending(true)
    try {
      await api.post(`/ads/meta/pending/${pendingToken}/confirm`, { accountIds: selectedPendingIds })
      setPendingToken(null)
      toast.success('Conta(s) de anúncios conectada(s) com sucesso!')
      if (pendingClientId) loadAccounts(pendingClientId)
    } catch (err) {
      toast.error('Erro ao confirmar a seleção', getErrorMessage(err))
    } finally {
      setConfirmingPending(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const { data } = await api.get('/ads/meta/connect', { params: { clientId } })
      window.location.href = data.authUrl
    } catch (err) {
      toast.error('Erro ao iniciar conexão com a Meta', getErrorMessage(err))
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!account) return
    const ok = await confirmDialog({
      title: 'Desconectar esta conta de anúncios?',
      description: `A sincronização de métricas e as sugestões do Brand Brain para "${account.accountName}" vão parar.`,
      variant: 'destructive',
      confirmLabel: 'Desconectar',
    })
    if (!ok) return
    try {
      await api.delete(`/ads/accounts/${account.id}`)
      toast.success('Conta desconectada.')
      loadAccounts(clientId)
    } catch (err) {
      toast.error('Erro ao desconectar', getErrorMessage(err))
    }
  }

  const handleSync = async () => {
    if (!accountId) return
    setSyncing(true)
    try {
      await api.post(`/ads/accounts/${accountId}/sync`)
      await loadInsights(accountId, range, campaignFilter || undefined)
      setAudienceVersion((version) => version + 1)
      toast.success('Métricas atualizadas!')
    } catch (err) {
      toast.error('Erro ao atualizar métricas', getErrorMessage(err))
    } finally {
      setSyncing(false)
    }
  }

  const handleAnalyze = async () => {
    if (!accountId) return
    setAnalyzing(true)
    try {
      const { data } = await api.post(`/ads/accounts/${accountId}/analyze`, {
        ...(campaignFilter ? { campaignExternalId: campaignFilter } : {}),
      })
      toast.success(`${data.length || 0} recomendações geradas pelo Brand Brain!`)
      await loadRecommendations(accountId)
    } catch (err) {
      toast.error('Erro ao analisar com Brand Brain', getErrorMessage(err))
    } finally {
      setAnalyzing(false)
    }
  }

  const handleApply = async (rec: any) => {
    const ok = await confirmDialog({
      title: `Aplicar: ${ACTION_LABELS[rec.actionType]?.label || rec.actionType}?`,
      description: `Isso muda de verdade a campanha "${rec.campaignName}" na Meta. ${rec.reasoning}`,
      confirmLabel: 'Aplicar',
    })
    if (!ok) return
    setActingOnId(rec.id)
    try {
      await api.post(`/ads/recommendations/${rec.id}/apply`)
      toast.success('Ação aplicada na Meta!')
      await Promise.all([loadRecommendations(accountId), loadInsights(accountId, range, campaignFilter || undefined)])
    } catch (err) {
      toast.error('Erro ao aplicar ação', getErrorMessage(err))
    } finally {
      setActingOnId(null)
    }
  }

  // Direct pause/reactivate from the table — independent of the AI recommendation flow below,
  // for when the agency already knows what they want to do and doesn't need to wait on "Analisar
  // com Brand Brain" first.
  const handleToggleCampaignStatus = async (campaign: any) => {
    const nextStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    const ok = await confirmDialog({
      title: nextStatus === 'PAUSED' ? `Pausar "${campaign.campaignName}"?` : `Reativar "${campaign.campaignName}"?`,
      description: 'Isso muda de verdade o status da campanha na Meta.',
      confirmLabel: nextStatus === 'PAUSED' ? 'Pausar' : 'Reativar',
      variant: nextStatus === 'PAUSED' ? 'destructive' : undefined,
    })
    if (!ok) return
    setTogglingCampaignId(campaign.campaignExternalId)
    try {
      await api.post(`/ads/accounts/${accountId}/campaigns/${campaign.campaignExternalId}/status`, { status: nextStatus })
      toast.success(nextStatus === 'PAUSED' ? 'Campanha pausada na Meta.' : 'Campanha reativada na Meta.')
      await loadInsights(accountId, range, campaignFilter || undefined)
    } catch (err) {
      toast.error('Erro ao alterar status da campanha', getErrorMessage(err))
    } finally {
      setTogglingCampaignId(null)
    }
  }

  const handleDismiss = async (rec: any) => {
    setActingOnId(rec.id)
    try {
      await api.post(`/ads/recommendations/${rec.id}/dismiss`)
      await loadRecommendations(accountId)
    } catch (err) {
      toast.error('Erro ao dispensar', getErrorMessage(err))
    } finally {
      setActingOnId(null)
    }
  }

  const kpis = insights ? [
    { label: 'Investimento', value: formatCurrency(insights.totals.spend, account?.currency), icon: Wallet },
    { label: 'Impressões', value: insights.totals.impressions.toLocaleString('pt-BR'), icon: EyeIcon },
    { label: 'Cliques', value: insights.totals.clicks.toLocaleString('pt-BR'), icon: MousePointerClick },
    { label: 'CTR', value: `${insights.totals.ctr.toFixed(2)}%`, icon: TrendingUp },
    { label: 'CPC', value: formatCurrency(insights.totals.cpc, account?.currency), icon: Target },
    {
      label: 'Resultados',
      value: insights.totals.results.toLocaleString('pt-BR'),
      icon: Check,
      // "Resultados" isn't one fixed thing — Meta picks the metric that matches each campaign's
      // own objective (mensagens iniciadas, cliques, leads, compras...), same as its own Ads
      // Manager does. Spelled out here since a bare number invites assuming it means whatever the
      // reader expects (confirmed: was read as "people who made contact" for a campaign where the
      // number was actually link clicks before this was fixed).
      hint: 'A métrica mais relevante de cada campanha (mensagens iniciadas, cliques, leads, etc.), conforme o objetivo configurado na Meta, mesmo critério do "Resultados" no Ads Manager.',
    },
    {
      label: 'Custo/Resultado',
      value: insights.totals.costPerResult != null ? formatCurrency(insights.totals.costPerResult, account?.currency) : '—',
      icon: TrendingDown,
    },
  ] : []

  const audienceKpis = audience ? [
    { label: 'Alcance', value: audience.reach?.toLocaleString('pt-BR') || '—', icon: Users },
    { label: 'Frequência', value: audience.frequency != null ? audience.frequency.toFixed(2) : '—', icon: Radio },
    { label: 'Cliques no link', value: audience.linkClicks.toLocaleString('pt-BR'), icon: MousePointerClick },
    { label: 'Contatos iniciados', value: audience.contacts.toLocaleString('pt-BR'), icon: MessageCircle },
    { label: 'Contatos / clique', value: audience.contactRate != null ? `${audience.contactRate.toFixed(1)}%` : '—', icon: TrendingUp },
  ] : []

  // Scoped to the same campaign as the KPI cards above — with a specific campaign selected,
  // seeing recommendations for a different one back-to-back is exactly the "which campaign is
  // this about" confusion the picker was added to resolve in the first place.
  const visiblePendingRecs = recommendations.filter(
    (r) => r.status === 'PENDING' && (!campaignFilter || r.campaignExternalId === campaignFilter)
  )

  return (
    <Page>
      <PageHeader
        icon={<PageIcon><BrandIcon platform="META_ADS" size={22} /></PageIcon>}
        title="Meta Ads"
        description="Performance sincronizada da Meta, com sugestões de otimização do Brand Brain."
        actions={
          <div className="w-full min-w-0 sm:w-64">
            <Select value={clientId} onValueChange={setClientId} disabled={loadingClients}>
              <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {loadingAccounts ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma conta de anúncios conectada"
          description="Conecte a conta de anúncios da Meta deste cliente pra ver performance de campanhas e receber sugestões de otimização do Brand Brain."
          action={
            <Button onClick={handleConnect} loading={connecting}>
              {!connecting && <><Plus size={16} /><span>Conectar conta de anúncios</span></>}
            </Button>
          }
        />
      ) : (
        <>
          {/* Account + scope toolbar: one surface, same controls as the rest of the app */}
          <section aria-label="Conta e período" className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-border/70 bg-card p-4 shadow-card sm:p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/60">
                <BrandIcon platform="META_ADS" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {accounts.length > 1 ? (
                    <div className="w-full min-w-0 max-w-64 sm:w-56">
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger aria-label="Conta de anúncios"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="min-w-0 truncate text-[15px] font-semibold text-foreground">{account?.accountName}</p>
                  )}
                  <Badge dot variant={account?.status === 'ACTIVE' ? 'success' : 'default'}>{AD_STATUS_LABELS[account?.status] || account?.status}</Badge>
                </div>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                  {loadingInsights ? 'Consultando métricas…' : insights?.lastSyncedAt ? `${range === 'today' ? 'Consultado' : 'Sincronizado'} ${new Date(insights.lastSyncedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Ainda não sincronizado'}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {/* Campaign scope — totals, chart and Brand Brain analysis follow it; the campaigns
                 table below always lists every campaign. */}
              {insights?.campaigns?.length > 1 && (
                <div className="w-full min-w-0 sm:w-64">
                  <Select value={campaignFilter || '__all__'} onValueChange={(v) => setCampaignFilter(v === '__all__' ? '' : v)}>
                    <SelectTrigger aria-label="Campanha"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas as campanhas</SelectItem>
                      {insights.campaigns.map((c: any) => (
                        <SelectItem key={c.campaignExternalId} value={c.campaignExternalId}>{c.campaignName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Period + icon actions share one row, also on phones */}
              <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                <div className="min-w-0 flex-1 sm:flex-none">
                  <Segmented label="Período" value={range} onChange={setRange}
                    options={[{ value: 'today', label: 'Hoje' }, { value: '7d', label: '7 dias' }, { value: '30d', label: '30 dias' }]} />
                </div>
                <Button type="button" variant="outline" size="icon" className="size-10 shrink-0 p-0" aria-label="Atualizar dados" title="Atualizar dados" onClick={handleSync} disabled={syncing}>
                  <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                </Button>
                <Button type="button" variant="outline" size="icon" className="size-10 shrink-0 p-0 hover:border-error/40 hover:bg-error/10 hover:text-error" aria-label="Desconectar conta" title="Desconectar conta" onClick={handleDisconnect}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          </section>

          {/* KPIs */}
          {loadingInsights ? (
            <Skeleton className="h-[236px] rounded-2xl min-[1440px]:h-[118px]" />
          ) : insights && (<>
            {/* One sentence summary (Meta Business Suite style) */}
            <p className="text-[15px] leading-relaxed text-foreground/85">
              <span className="font-semibold text-foreground">{clients.find((c) => c.id === clientId)?.name || account?.accountName || 'Esta conta'}</span>
              {' '}investiu <span className="font-semibold text-foreground">{formatCurrency(insights.totals.spend, account?.currency)}</span>
              {' '}em {insights.campaigns?.length || 0} {(insights.campaigns?.length || 0) === 1 ? 'campanha' : 'campanhas'}
              {' '}{range === 'today' ? 'hoje' : range === '7d' ? 'nos últimos 7 dias' : 'nos últimos 30 dias'}.
            </p>

            {/* KPI tiles drive the chart below — no duplicated metric pickers */}
            <MetricExplorer
              tiles={kpis.map((k: any) => ({ ...k, key: k.label, chart: CHARTABLE[k.label] }))}
              rows={range === 'today' ? (insights.hourly || []) : (insights.daily || [])}
              labelOf={(row) => range === 'today' ? String(row.hour) : format(new Date(`${String(row.date).slice(0, 10)}T12:00:00`), 'd MMM', { locale: ptBR })}
              tooltipOf={(row) => range === 'today' ? `Hoje, ${row.hour}` : format(new Date(`${String(row.date).slice(0, 10)}T12:00:00`), "EEEE, d 'de' MMM", { locale: ptBR })}
              caption={range === 'today' ? 'Por hora · fuso da conta de anúncios' : 'Por dia'}
              empty={range === 'today' ? 'Ainda sem entregas registradas hoje.' : 'Sem dados diários neste período.'}
            />
          </>)}

          {/* Live Meta breakdowns are aggregate estimates, never individual locations. */}
          <Card className="min-w-0 p-4 sm:p-5 lg:p-6">
            <CardHeader className="items-start gap-3 pb-4">
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base">Onde os anúncios geram contatos</CardTitle>
                <CardDescription className="mt-1 max-w-3xl leading-relaxed">Dados agregados da Meta para o período e campanha selecionados. A região refere-se à entrega do anúncio; não identifica a localização de cada pessoa.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-5">
              {loadingAudience ? <Skeleton className="h-40 rounded-xl" /> : audienceError ? (
                <p className="text-xs text-muted-foreground">Não foi possível obter os dados detalhados da Meta. Tente atualizar.</p>
              ) : audience ? <>
                <StatGroup className="lg:grid-cols-5 [&>*]:bg-muted/30">
                  {audienceKpis.map((k) => <Stat key={k.label} label={k.label} value={k.value} icon={k.icon} />)}
                </StatGroup>
                <AudienceBreakdown
                  regions={audience.regions}
                  demographics={audience.demographics}
                  placements={audience.placements}
                  formatMoney={value => formatCurrency(value, account?.currency)}
                />
              </> : <p className="text-xs text-muted-foreground">Selecione uma conta para ver os dados.</p>}
            </CardContent>
          </Card>

          {/* Campaigns table */}
          <Card className="min-w-0 p-4 sm:p-5 lg:p-6">
            <CardHeader className="items-start pb-4">
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base">Campanhas</CardTitle>
                <CardDescription className="mt-1">{range === 'today' ? 'Hoje' : range === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-3">
              {!!insights?.campaigns?.length && (() => {
                const all = insights.campaigns as any[]
                const tabs = [
                  { key: 'all' as const, label: 'Todas', count: all.length },
                  { key: 'ACTIVE' as const, label: 'Ativas', count: all.filter((c) => c.status === 'ACTIVE').length },
                  { key: 'PAUSED' as const, label: 'Pausadas', count: all.filter((c) => c.status === 'PAUSED').length },
                ]
                return (
                  <FilterBar pills={tabs} value={statusTab} onChange={setStatusTab} query={campaignQuery} onQuery={setCampaignQuery} placeholder="Pesquisar campanha" label="Filtrar campanhas por estado" />
                )
              })()}
              {loadingInsights ? <Skeleton className="h-28 rounded-xl" /> : !insights?.campaigns?.length ? (
                <p className="text-xs text-muted-foreground font-medium py-6 text-center">
                  Nenhum dado sincronizado ainda pra esse período, clique em "Atualizar".
                </p>
              ) : (<>
                {/* Phones: one card per campaign — the table needed sideways scrolling to see spend/results */}
                <ul className="-mx-1 divide-y divide-border/70 md:hidden">
                  {(() => {
                    const q = campaignQuery.trim().toLowerCase()
                    const visible = (insights.campaigns as any[]).filter((c) =>
                      (statusTab === 'all' || c.status === statusTab) && (!q || String(c.campaignName || '').toLowerCase().includes(q)))
                    if (!visible.length) return <li className="py-8 text-center text-xs text-muted-foreground">Nenhuma campanha corresponde a este filtro.</li>
                    return visible.map((c: any) => {
                      const canToggle = c.status === 'ACTIVE' || c.status === 'PAUSED'
                      const isToggling = togglingCampaignId === c.campaignExternalId
                      return (
                        <li key={c.campaignExternalId} className="px-1 py-3.5">
                          <div className="flex items-start gap-3">
                            <CampaignCreativePreview key={`m-${accountId}-${c.campaignExternalId}`} accountId={accountId} campaignId={c.campaignExternalId} campaignName={c.campaignName} />
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 break-words text-[13px] font-semibold leading-snug text-foreground">{c.campaignName}</p>
                              <Badge dot variant={c.status === 'ACTIVE' ? 'success' : 'default'} className="mt-1.5 text-[11px]">{AD_STATUS_LABELS[c.status] || c.status}</Badge>
                            </div>
                            {canToggle && (
                              <Button type="button" variant="outline" size="sm" onClick={() => handleToggleCampaignStatus(c)} disabled={isToggling}
                                aria-label={c.status === 'ACTIVE' ? 'Pausar campanha' : 'Reativar campanha'} className="size-9 shrink-0 p-0">
                                {isToggling ? <Loader2 size={14} className="animate-spin" /> : c.status === 'ACTIVE' ? <Pause size={14} /> : <Play size={14} />}
                              </Button>
                            )}
                          </div>
                          <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2.5 text-center">
                            <div><dt className="text-[11px] text-muted-foreground">Gasto</dt><dd className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-foreground">{formatCurrency(c.spend, account?.currency)}</dd></div>
                            <div><dt className="text-[11px] text-muted-foreground">Resultados</dt><dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground">{c.results}</dd></div>
                            <div><dt className="text-[11px] text-muted-foreground">Custo/res.</dt><dd className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-foreground">{c.results ? formatCurrency(c.spend / c.results, account?.currency) : '—'}</dd></div>
                          </dl>
                        </li>
                      )
                    })
                  })()}
                </ul>
                <div className="hidden overflow-x-auto pb-1 md:block [scrollbar-width:thin]">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="w-[36%] py-3 pr-4">Campanha</th>
                        <th className="whitespace-nowrap py-3 pr-4">Status</th>
                        <th className="whitespace-nowrap py-3 pr-4 text-right">Gasto</th>
                        <th className="whitespace-nowrap py-3 pr-4 text-right">Resultados</th>
                        <th className="whitespace-nowrap py-3 pr-4 text-right">Custo/Resultado</th>
                        <th className="py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const q = campaignQuery.trim().toLowerCase()
                        const visible = (insights.campaigns as any[]).filter((c) =>
                          (statusTab === 'all' || c.status === statusTab) && (!q || String(c.campaignName || '').toLowerCase().includes(q)))
                        if (!visible.length) return (
                          <tr><td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">Nenhuma campanha corresponde a este filtro.</td></tr>
                        )
                        return visible.map((c: any) => {
                        const canToggle = c.status === 'ACTIVE' || c.status === 'PAUSED'
                        const isToggling = togglingCampaignId === c.campaignExternalId
                        return (
                          <tr key={c.campaignExternalId} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40">
                            <td className="max-w-[24rem] py-3.5 pr-4 font-medium leading-relaxed text-foreground"><div className="flex items-center gap-3"><CampaignCreativePreview key={`${accountId}-${c.campaignExternalId}`} accountId={accountId} campaignId={c.campaignExternalId} campaignName={c.campaignName} /><span className="min-w-0 break-words">{c.campaignName}</span></div></td>
                            <td className="whitespace-nowrap py-3.5 pr-4">
                              <Badge dot variant={c.status === 'ACTIVE' ? 'success' : 'default'} className="text-[11px]">{AD_STATUS_LABELS[c.status] || c.status}</Badge>
                            </td>
                            <td className="whitespace-nowrap py-3.5 pr-4 text-right font-semibold tabular-nums text-foreground">{formatCurrency(c.spend, account?.currency)}</td>
                            <td className="whitespace-nowrap py-3.5 pr-4 text-right tabular-nums text-foreground">{c.results}</td>
                            <td className="whitespace-nowrap py-3.5 pr-4 text-right tabular-nums text-foreground">
                              {c.results ? formatCurrency(c.spend / c.results, account?.currency) : '—'}
                            </td>
                            <td className="whitespace-nowrap py-3.5 text-right">
                              {canToggle && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleCampaignStatus(c)}
                                  disabled={isToggling}
                                  className="h-8 px-2.5 text-[11px] hover:bg-primary/10 hover:text-primary"
                                >
                                  {isToggling ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : c.status === 'ACTIVE' ? (
                                    <><Pause size={12} /><span>Pausar</span></>
                                  ) : (
                                    <><Play size={12} /><span>Reativar</span></>
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                      })()}
                    </tbody>
                  </table>
                </div>
              </>)}
            </CardContent>
          </Card>

          {/* AI Recommendations */}
          <Card className="min-w-0 p-4 sm:p-5 lg:p-6">
            <CardHeader className="items-start gap-4 pb-4 lg:items-center">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm sm:text-base">Recomendações do Brand Brain</CardTitle>
                <CardDescription className="mt-1 max-w-3xl leading-relaxed">
                  {campaignFilter
                    ? `Analisando só "${insights?.campaigns?.find((c: any) => c.campaignExternalId === campaignFilter)?.campaignName || 'campanha selecionada'}", nada muda sem você aplicar.`
                    : 'Sugestões geradas a partir dos dados sincronizados, nada muda sem você aplicar.'}
                </CardDescription>
              </div>
              <Button size="sm" onClick={handleAnalyze} loading={analyzing} className="w-full text-xs sm:w-auto sm:shrink-0">
                {!analyzing && <><Sparkles size={14} /><span>Analisar com Brand Brain</span></>}
              </Button>
            </CardHeader>
            <CardContent className="min-w-0 space-y-3">
              {loadingRecs ? (
                <div className="space-y-2">
                  {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
                </div>
              ) : visiblePendingRecs.length === 0 ? (
                <p className="text-xs text-muted-foreground font-medium py-6 text-center">
                  {campaignFilter && recommendations.some((r) => r.status === 'PENDING')
                    ? 'Nenhuma recomendação pendente para esta campanha. Outras campanhas têm sugestões em "Todas as campanhas".'
                    : 'Nenhuma recomendação pendente. Clique em "Analisar com Brand Brain" pra gerar sugestões com base nos dados sincronizados.'}
                </p>
              ) : (
                visiblePendingRecs.map((rec) => (
                  <div key={rec.id} className="min-w-0 space-y-4 rounded-xl border border-border bg-muted/40 p-4 transition-colors hover:border-primary/30 sm:p-5">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant={ACTION_LABELS[rec.actionType]?.variant || 'default'}>
                            {ACTION_LABELS[rec.actionType]?.label || rec.actionType}
                          </Badge>
                          <span className="min-w-0 break-words text-xs font-bold text-foreground">{rec.campaignName}</span>
                        </div>
                        <p className="break-words text-xs font-medium leading-relaxed text-muted-foreground">{rec.reasoning}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-stretch gap-2 border-t border-border/70 pt-3 sm:justify-end">
                      <Button
                        type="button" variant="ghost" size="sm"
                        onClick={() => handleDismiss(rec)}
                        disabled={actingOnId === rec.id}
                        className="min-w-0 flex-1 text-xs sm:flex-none"
                      >
                        <X size={13} /><span>Dispensar</span>
                      </Button>
                      {rec.actionType !== 'ADVISORY' && (
                        <Button type="button" size="sm" onClick={() => handleApply(rec)} disabled={actingOnId === rec.id} className="min-w-0 flex-1 text-xs sm:flex-none">
                          {actingOnId === rec.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          <span>Aplicar</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Ad account picker */}
      <Dialog open={!!pendingToken} onOpenChange={(open) => !open && setPendingToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escolha a conta de anúncios</DialogTitle>
            <DialogDescription>Encontramos mais de uma conta de anúncios nesse login da Meta, selecione qual pertence a este cliente.</DialogDescription>
          </DialogHeader>

          {loadingPending ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {pendingAccounts.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    'flex min-w-0 items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-primary/30',
                    selectedPendingIds.includes(a.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedPendingIds.includes(a.id)}
                    onChange={() => togglePendingSelection(a.id)}
                    className="accent-primary"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">{a.currency}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingToken(null)}>Cancelar</Button>
            <Button type="button" onClick={handleConfirmPendingSelection} loading={confirmingPending} disabled={selectedPendingIds.length === 0}>
              {!confirmingPending && <span>Conectar ({selectedPendingIds.length})</span>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
