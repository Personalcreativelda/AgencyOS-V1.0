import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Megaphone, Plus, RefreshCw, Sparkles, TrendingUp, TrendingDown, Eye as EyeIcon,
  MousePointerClick, Wallet, Target, Check, X, Trash2, Loader2, Pause, Play,
  MapPin, Users, MessageCircle, Radio,
} from 'lucide-react'
import api from '@/lib/api'
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

const ACTION_LABELS: Record<string, { label: string; variant: 'error' | 'success' | 'warning' | 'default' }> = {
  PAUSE: { label: 'Pausar', variant: 'error' },
  INCREASE_BUDGET: { label: 'Aumentar orçamento', variant: 'success' },
  DECREASE_BUDGET: { label: 'Reduzir orçamento', variant: 'warning' },
  ADVISORY: { label: 'Revisar', variant: 'default' },
}

function formatCurrency(value: number, currency?: string | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value || 0)
}

type Segment = { label: string; spend: number; impressions: number; clicks: number; results: number; contacts: number }
type AudienceInsights = {
  regions: Segment[]; demographics: Segment[]; placements: Segment[]
  contacts: number; linkClicks: number; contactRate: number | null
  reach: number | null; frequency: number | null
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
        const { data } = await api.get('/clients')
        setClients(data.data || [])
        if (data.data?.length > 0) setClientId(data.data[0].id)
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
      const { data } = await api.get('/ads/accounts', { params: { clientId: cid } })
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
      const { data } = await api.get(`/ads/accounts/${id}/insights`, {
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
      const { data } = await api.get('/ads/recommendations', { params: { connectionId: id } })
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
    api.get(`/ads/accounts/${accountId}/audience`, {
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
      description: `A sincronização de métricas e as sugestões do Brand Brain pra "${account.accountName}" vão parar.`,
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
      hint: 'A métrica mais relevante de cada campanha (mensagens iniciadas, cliques, leads, etc.), conforme o objetivo configurado na Meta — mesmo critério do "Resultados" no Ads Manager.',
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
    { label: 'Contactos iniciados', value: audience.contacts.toLocaleString('pt-BR'), icon: MessageCircle },
    { label: 'Contactos / clique', value: audience.contactRate != null ? `${audience.contactRate.toFixed(1)}%` : '—', icon: TrendingUp },
  ] : []

  // Scoped to the same campaign as the KPI cards above — with a specific campaign selected,
  // seeing recommendations for a different one back-to-back is exactly the "which campaign is
  // this about" confusion the picker was added to resolve in the first place.
  const visiblePendingRecs = recommendations.filter(
    (r) => r.status === 'PENDING' && (!campaignFilter || r.campaignExternalId === campaignFilter)
  )

  return (
    <div className="mx-auto w-full max-w-[1600px] min-w-0 space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8 2xl:px-10">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:gap-6">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">Meta Ads</h1>
          <p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-muted-foreground sm:text-sm">
            Performance sincronizada da Meta, com sugestões de otimização do Brand Brain.
          </p>
        </div>

        <div className="w-full min-w-0 sm:w-56 sm:shrink-0 lg:w-64">
          <Select value={clientId} onValueChange={setClientId} disabled={loadingClients}>
            <SelectTrigger className="shadow-sm hover:border-primary/40 focus-visible:ring-primary/30"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

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
              {!connecting && <><Plus size={16} /><span>Conectar Conta de Anúncios</span></>}
            </Button>
          }
        />
      ) : (
        <>
          {/* Account bar */}
          <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-muted/60 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-dark sm:h-11 sm:w-11 sm:rounded-2xl">
                <Megaphone size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {accounts.length > 1 ? (
                    <div className="min-w-0 w-full max-w-64 sm:w-56">
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger className="h-9 text-xs hover:border-primary/40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="min-w-0 truncate text-xs font-extrabold text-foreground sm:text-sm">{account?.accountName}</p>
                  )}
                  <Badge variant={account?.status === 'ACTIVE' ? 'success' : 'default'}>{account?.status}</Badge>
                </div>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted-foreground">
                  {loadingInsights ? 'A consultar métricas...' : insights?.lastSyncedAt ? `${range === 'today' ? 'Consultado' : 'Sincronizado'} ${new Date(insights.lastSyncedAt).toLocaleString('pt-BR')}` : 'Ainda não sincronizado'}
                </p>
              </div>
            </div>

            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:justify-end">
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-border bg-card p-1 sm:flex-none">
                {(['today', '7d', '30d'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={cn(
                      'flex-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-none sm:px-3',
                      range === r ? 'bg-primary text-[#fff]' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {r === 'today' ? 'Hoje' : r === '7d' ? '7 dias' : '30 dias'}
                  </button>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleSync} loading={syncing} className="min-w-0 flex-1 border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted sm:flex-none">
                {!syncing && <RefreshCw size={14} />}
                <span>Atualizar</span>
              </Button>
              <button
                type="button"
                title="Desconectar conta"
                onClick={handleDisconnect}
                className="shrink-0 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* Campaign scope — the cards and "Analisar com Brand Brain" below reflect whichever
             is picked here; the campaigns table further down always lists every campaign
             regardless, so switching this never hides a campaign, only what the summary/AI
             focuses on. */}
          {insights?.campaigns?.length > 1 && (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mostrando:</span>
              <div className="w-full min-w-0 sm:w-72 lg:w-80">
                <Select value={campaignFilter || '__all__'} onValueChange={(v) => setCampaignFilter(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-9 text-xs hover:border-primary/40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as campanhas (combinado)</SelectItem>
                    {insights.campaigns.map((c: any) => (
                      <SelectItem key={c.campaignExternalId} value={c.campaignExternalId}>{c.campaignName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* KPIs */}
          {loadingInsights ? (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 min-[1440px]:grid-cols-7">
              {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : insights && (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 min-[420px]:[&>*:last-child]:col-span-2 lg:grid-cols-4 lg:[&>*:last-child]:col-span-2 min-[1440px]:grid-cols-7 min-[1440px]:[&>*:last-child]:col-span-1">
              {kpis.map((k: any) => (
                <div key={k.label} className="card-minimals flex min-h-24 min-w-0 flex-col justify-between gap-3 p-4 transition-colors hover:border-primary/30 sm:p-5" title={k.hint}>
                  <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <k.icon size={14} className="shrink-0 text-primary" />
                    <span className="min-w-0 text-[10px] font-bold uppercase leading-tight tracking-wider sm:text-[11px]">{k.label}</span>
                  </div>
                  <p className="break-words text-lg font-extrabold tabular-nums tracking-tight text-foreground sm:text-xl">{k.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Live Meta breakdowns are aggregate estimates, never individual locations. */}
          <Card className="min-w-0 p-4 sm:p-5 lg:p-6">
            <CardHeader className="items-start gap-3 pb-4">
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base">Onde os anúncios geram contactos</CardTitle>
                <CardDescription className="mt-1 max-w-3xl leading-relaxed">Dados agregados da Meta para o período e campanha selecionados. A região refere-se à entrega do anúncio; não identifica a localização de cada pessoa.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-5">
              {loadingAudience ? <Skeleton className="h-40 rounded-xl" /> : audienceError ? (
                <p className="text-xs text-muted-foreground">Não foi possível obter os dados detalhados da Meta. Tente atualizar.</p>
              ) : audience ? <>
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 min-[420px]:[&>*:last-child]:col-span-2 lg:grid-cols-3 lg:[&>*:last-child]:col-span-2 min-[1440px]:grid-cols-5 min-[1440px]:[&>*:last-child]:col-span-1">
                  {audienceKpis.map((k) => <div key={k.label} className="flex min-h-20 min-w-0 flex-col justify-between gap-2 rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:border-primary/30 sm:p-4">
                    <div className="flex min-w-0 items-center gap-2 text-muted-foreground"><k.icon size={13} className="shrink-0 text-primary" /><span className="text-[10px] font-bold uppercase leading-tight tracking-wider">{k.label}</span></div>
                    <p className="break-words text-base font-extrabold tabular-nums tracking-tight text-foreground sm:text-lg">{k.value}</p>
                  </div>)}
                </div>
                <p className="max-w-4xl text-[11px] leading-relaxed text-muted-foreground">Contactos iniciados incluem conversas ou leads reportados pela Meta. A taxa usa cliques no link como base e não representa pessoas únicas.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:[&>*:last-child]:col-span-2 lg:grid-cols-3 lg:gap-4 lg:[&>*:last-child]:col-span-1">
                  {([
                    { title: 'Regiões', icon: MapPin, rows: audience.regions },
                    { title: 'Públicos', icon: Users, rows: audience.demographics },
                    { title: 'Posicionamentos', icon: Target, rows: audience.placements },
                  ] as const).map((group) => <div key={group.title} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 sm:p-5">
                    <h3 className="flex items-center gap-2 text-xs font-bold text-foreground sm:text-sm"><group.icon size={14} className="shrink-0 text-primary" />{group.title}</h3>
                    {group.rows.length ? group.rows.map((row) => <div key={row.label} className="min-w-0 border-t border-border pt-3 text-xs">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1 font-semibold text-foreground"><span className="min-w-0 break-words">{row.label}</span><span className="shrink-0 tabular-nums">{row.contacts} contactos</span></div>
                      <div className="mt-1.5 break-words leading-relaxed text-muted-foreground">{row.clicks} cliques · {row.results} resultados · {formatCurrency(row.spend, account?.currency)} gastos</div>
                    </div>) : <p className="text-xs text-muted-foreground">Sem dados disponíveis neste período.</p>}
                  </div>)}
                </div>
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
            <CardContent className="min-w-0 space-y-2">
              {loadingInsights ? <Skeleton className="h-28 rounded-xl" /> : !insights?.campaigns?.length ? (
                <p className="text-xs text-muted-foreground font-medium py-6 text-center">
                  Nenhum dado sincronizado ainda pra esse período — clique em "Atualizar".
                </p>
              ) : (
                <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="w-[36%] py-3 pr-4">Campanha</th>
                        <th className="whitespace-nowrap py-3 pr-4">Status</th>
                        <th className="whitespace-nowrap py-3 pr-4 text-right">Gasto</th>
                        <th className="whitespace-nowrap py-3 pr-4 text-right">Resultados</th>
                        <th className="whitespace-nowrap py-3 pr-4 text-right">Custo/Resultado</th>
                        <th className="py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.campaigns.map((c: any) => {
                        const canToggle = c.status === 'ACTIVE' || c.status === 'PAUSED'
                        const isToggling = togglingCampaignId === c.campaignExternalId
                        return (
                          <tr key={c.campaignExternalId} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40">
                            <td className="max-w-[24rem] py-3.5 pr-4 font-bold leading-relaxed text-foreground">{c.campaignName}</td>
                            <td className="whitespace-nowrap py-3.5 pr-4">
                              <Badge variant={c.status === 'ACTIVE' ? 'success' : 'default'} className="text-[10px]">{c.status}</Badge>
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
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Recommendations */}
          <Card className="min-w-0 p-4 sm:p-5 lg:p-6">
            <CardHeader className="items-start gap-4 pb-4 lg:items-center">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm sm:text-base">Recomendações do Brand Brain</CardTitle>
                <CardDescription className="mt-1 max-w-3xl leading-relaxed">
                  {campaignFilter
                    ? `Analisando só "${insights?.campaigns?.find((c: any) => c.campaignExternalId === campaignFilter)?.campaignName || 'campanha selecionada'}" — nada muda sem você aplicar.`
                    : 'Sugestões geradas a partir dos dados sincronizados — nada muda sem você aplicar.'}
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
                    ? 'Nenhuma recomendação pendente para esta campanha — outras campanhas têm sugestões, veja em "Todas as campanhas".'
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escolha a conta de anúncios</DialogTitle>
            <DialogDescription>Encontramos mais de uma conta de anúncios nesse login da Meta — selecione qual pertence a este cliente.</DialogDescription>
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
            <Button type="button" variant="ghost" onClick={() => setPendingToken(null)}>Cancelar</Button>
            <Button type="button" onClick={handleConfirmPendingSelection} loading={confirmingPending} disabled={selectedPendingIds.length === 0}>
              {!confirmingPending && <span>Conectar ({selectedPendingIds.length})</span>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
