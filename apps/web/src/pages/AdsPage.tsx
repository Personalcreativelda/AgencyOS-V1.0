import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Megaphone, Plus, RefreshCw, Sparkles, TrendingUp, TrendingDown, Eye as EyeIcon,
  MousePointerClick, Wallet, Target, Check, X, Trash2, Loader2,
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

export function AdsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [clients, setClients] = useState<any[]>([])
  const [clientId, setClientId] = useState('')
  const [loadingClients, setLoadingClients] = useState(true)

  const [accounts, setAccounts] = useState<any[]>([])
  const [accountId, setAccountId] = useState('')
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const [range, setRange] = useState<'7d' | '30d'>('7d')
  const [insights, setInsights] = useState<any>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [actingOnId, setActingOnId] = useState<string | null>(null)

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

  const loadInsights = async (id: string, r: '7d' | '30d') => {
    setLoadingInsights(true)
    try {
      const { data } = await api.get(`/ads/accounts/${id}/insights`, { params: { range: r } })
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

  useEffect(() => {
    if (accountId) {
      loadInsights(accountId, range)
      loadRecommendations(accountId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, range])

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
      description: `A sincronização de métricas e as sugestões de IA pra "${account.accountName}" vão parar.`,
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
      await loadInsights(accountId, range)
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
      const { data } = await api.post(`/ads/accounts/${accountId}/analyze`)
      toast.success(`${data.length || 0} recomendações geradas pela IA!`)
      await loadRecommendations(accountId)
    } catch (err) {
      toast.error('Erro ao analisar com IA', getErrorMessage(err))
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
      await Promise.all([loadRecommendations(accountId), loadInsights(accountId, range)])
    } catch (err) {
      toast.error('Erro ao aplicar ação', getErrorMessage(err))
    } finally {
      setActingOnId(null)
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
    { label: 'Resultados', value: insights.totals.results.toLocaleString('pt-BR'), icon: Check },
    {
      label: 'Custo/Resultado',
      value: insights.totals.costPerResult != null ? formatCurrency(insights.totals.costPerResult, account?.currency) : '—',
      icon: TrendingDown,
    },
  ] : []

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Meta Ads</h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Performance de campanhas em tempo real, com sugestões de otimização por IA.
          </p>
        </div>

        <div className="w-full sm:w-56">
          <Select value={clientId} onValueChange={setClientId} disabled={loadingClients}>
            <SelectTrigger className="shadow-sm"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
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
          description="Conecte a conta de anúncios da Meta deste cliente pra ver performance de campanhas e receber sugestões de otimização por IA."
          action={
            <Button onClick={handleConnect} loading={connecting}>
              {!connecting && <><Plus size={16} /><span>Conectar Conta de Anúncios</span></>}
            </Button>
          }
        />
      ) : (
        <>
          {/* Account bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/60 rounded-2xl border border-border">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
                <Megaphone size={19} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {accounts.length > 1 ? (
                    <div className="w-48">
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="text-xs font-extrabold text-foreground truncate">{account?.accountName}</p>
                  )}
                  <Badge variant={account?.status === 'ACTIVE' ? 'success' : 'default'}>{account?.status}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {insights?.lastSyncedAt ? `Sincronizado ${new Date(insights.lastSyncedAt).toLocaleString('pt-BR')}` : 'Ainda não sincronizado'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <div className="flex items-center gap-1 rounded-xl bg-card p-1 border border-border">
                {(['7d', '30d'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                      range === r ? 'bg-primary text-[#fff]' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {r === '7d' ? '7 dias' : '30 dias'}
                  </button>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleSync} loading={syncing}>
                {!syncing && <RefreshCw size={14} />}
                <span>Atualizar</span>
              </Button>
              <button
                type="button"
                title="Desconectar conta"
                onClick={handleDisconnect}
                className="p-2 rounded-xl text-muted-foreground hover:text-error hover:bg-error/10 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* KPIs */}
          {loadingInsights ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : insights && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpis.map((k) => (
                <div key={k.label} className="card-minimals p-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <k.icon size={13} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">{k.label}</span>
                  </div>
                  <p className="text-lg font-extrabold text-foreground">{k.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Campaigns table */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Campanhas</CardTitle>
                <CardDescription>{range === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {!insights?.campaigns?.length ? (
                <p className="text-xs text-muted-foreground font-medium py-6 text-center">
                  Nenhum dado sincronizado ainda pra esse período — clique em "Atualizar".
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-border">
                        <th className="py-2 pr-3">Campanha</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3 text-right">Gasto</th>
                        <th className="py-2 pr-3 text-right">Resultados</th>
                        <th className="py-2 text-right">Custo/Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.campaigns.map((c: any) => (
                        <tr key={c.campaignExternalId} className="border-b border-border/60 last:border-0">
                          <td className="py-2.5 pr-3 font-bold text-foreground">{c.campaignName}</td>
                          <td className="py-2.5 pr-3">
                            <Badge variant={c.status === 'ACTIVE' ? 'success' : 'default'} className="text-[10px]">{c.status}</Badge>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold text-foreground">{formatCurrency(c.spend, account?.currency)}</td>
                          <td className="py-2.5 pr-3 text-right text-foreground">{c.results}</td>
                          <td className="py-2.5 text-right text-foreground">
                            {c.results ? formatCurrency(c.spend / c.results, account?.currency) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Recommendations */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recomendações da IA</CardTitle>
                <CardDescription>Sugestões geradas a partir dos dados sincronizados — nada muda sem você aplicar.</CardDescription>
              </div>
              <Button size="sm" onClick={handleAnalyze} loading={analyzing}>
                {!analyzing && <><Sparkles size={14} /><span>Analisar com IA</span></>}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingRecs ? (
                <div className="space-y-2">
                  {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
                </div>
              ) : recommendations.filter((r) => r.status === 'PENDING').length === 0 ? (
                <p className="text-xs text-muted-foreground font-medium py-6 text-center">
                  Nenhuma recomendação pendente. Clique em "Analisar com IA" pra gerar sugestões com base nos dados sincronizados.
                </p>
              ) : (
                recommendations.filter((r) => r.status === 'PENDING').map((rec) => (
                  <div key={rec.id} className="p-4 bg-muted/60 rounded-2xl border border-border space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={ACTION_LABELS[rec.actionType]?.variant || 'default'}>
                            {ACTION_LABELS[rec.actionType]?.label || rec.actionType}
                          </Badge>
                          <span className="text-xs font-bold text-foreground truncate">{rec.campaignName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">{rec.reasoning}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        type="button" variant="ghost" size="sm"
                        onClick={() => handleDismiss(rec)}
                        disabled={actingOnId === rec.id}
                      >
                        <X size={13} /><span>Dispensar</span>
                      </Button>
                      {rec.actionType !== 'ADVISORY' && (
                        <Button type="button" size="sm" onClick={() => handleApply(rec)} disabled={actingOnId === rec.id}>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha a conta de anúncios</DialogTitle>
            <DialogDescription>Encontramos mais de uma conta de anúncios nesse login da Meta — selecione qual pertence a este cliente.</DialogDescription>
          </DialogHeader>

          {loadingPending ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {pendingAccounts.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
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
