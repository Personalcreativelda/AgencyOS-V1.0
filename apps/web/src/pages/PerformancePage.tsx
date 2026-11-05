import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AxiosError } from 'axios'
import {
  Activity, ArrowUpRight, BarChart3, Facebook, Globe2, Instagram, Linkedin,
  Megaphone, MousePointerClick, Music2, RefreshCw, Sparkles, Users, Wallet, Youtube,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog'

type Period = 'today' | '7d' | '30d' | '90d'
type Tab = 'overview' | 'social' | 'ads' | 'website'
type ChartMetric = 'impressions' | 'clicks' | 'sessions' | 'views'
type ChartSource = 'all' | 'META_ADS' | 'GOOGLE_ADS' | 'GOOGLE_ANALYTICS'
type Daily = { date: string; [key: string]: string | number }
type ReportData = {
  currency?: string | null
  source?: 'live' | 'synced'
  lastSyncedAt?: string | null
  totals: Record<string, number>
  daily: Daily[]
  channels?: { label: string; sessions: number }[]
}
type Report = { platform: string; clientId: string; connectionId?: string; data: ReportData | null; error: string | null }
type Client = { id: string; name: string; status: string; website: string | null }
type Connection = { id: string; clientId: string; platform: string; accountName: string | null; status: string }
type Post = { id: string; clientId: string; title: string; platform: string; publishedAt: string; url: string | null }
type Overview = { range: Period; generatedAt: string; clients: Client[]; connections: Connection[]; reports: Report[]; posts: Post[] }
type Kpi = { label: string; value: string; note: string; icon: LucideIcon }

const periods: Record<Period, string> = {
  today: 'Hoje', '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', '90d': 'Últimos 90 dias',
}
const social = [
  { platform: 'FACEBOOK', label: 'Facebook', icon: Facebook, color: '#1877F2' },
  { platform: 'INSTAGRAM', label: 'Instagram', icon: Instagram, color: '#E4405F' },
  { platform: 'LINKEDIN', label: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
  { platform: 'TIKTOK', label: 'TikTok', icon: Music2, color: '#a4aab3' },
  { platform: 'YOUTUBE', label: 'YouTube', icon: Youtube, color: '#FF0033' },
] as const
const integrations = [
  ...social,
  { platform: 'META_ADS', label: 'Meta Ads', icon: Megaphone, color: '#1877F2' },
  { platform: 'GOOGLE_ADS', label: 'Google Ads', icon: BarChart3, color: '#4285F4' },
  { platform: 'TIKTOK_ADS', label: 'TikTok Ads', icon: Music2, color: '#a4aab3' },
  { platform: 'LINKEDIN_ADS', label: 'LinkedIn Ads', icon: Linkedin, color: '#0A66C2' },
  { platform: 'GOOGLE_ANALYTICS', label: 'GA4', icon: Globe2, color: '#F9AB00' },
]
const adPlatforms = ['META_ADS', 'GOOGLE_ADS', 'TIKTOK_ADS', 'LINKEDIN_ADS']
const chartMetrics: Record<ChartMetric, string> = {
  impressions: 'Impressões dos anúncios', clicks: 'Cliques nos anúncios',
  sessions: 'Sessões do website', views: 'Visualizações do website',
}

const number = (value: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)
const integer = (value: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(value)
const percent = (value: number) => `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(value)}%`
const dateLabel = (value: string) => new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`))
const dateTime = (value: string) => new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat('pt-PT', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value) }
  catch { return `${currency} ${number(value)}` }
}
function spendLabel(reports: Report[], platform?: string) {
  const groups = new Map<string, number>()
  let missingCurrency = 0
  for (const report of reports) {
    if (!report.data || (platform && report.platform !== platform)) continue
    if (!adPlatforms.includes(report.platform)) continue
    const currency = report.data.currency
    if (!currency) { missingCurrency++; continue }
    groups.set(currency, (groups.get(currency) || 0) + (report.data.totals.spend || 0))
  }
  if (!groups.size && !missingCurrency) return '—'
  return [...[...groups].map(([currency, amount]) => money(amount, currency)),
    ...(missingCurrency ? [`${missingCurrency} ${missingCurrency === 1 ? 'conta sem moeda' : 'contas sem moeda'}`] : [])].join(' · ')
}
function total(reports: Report[], platforms: string[], key: string): number | null {
  const matching = reports.filter(report => platforms.includes(report.platform) && report.data)
  if (!matching.length) return null
  return matching.reduce((sum, report) => sum + Number(report.data!.totals[key] || 0), 0)
}
function display(value: number | null) { return value === null ? '—' : integer(value) }
function SectionHeading({ title, description }: { title: string; description?: string }) {
  return <div><h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">{title}</h2>
    {description && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>}</div>
}
function KpiCard({ item }: { item: Kpi }) {
  const Icon = item.icon
  return <Card className="flex min-h-[138px] min-w-0 flex-col justify-between gap-4 p-4 transition-colors hover:border-primary/30 sm:p-5">
    <div className="flex items-start justify-between gap-3"><span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{item.label}</span><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon size={16} /></span></div>
    <div><p className="break-words text-xl font-bold tracking-tight text-foreground sm:text-2xl">{item.value}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.note}</p></div>
  </Card>
}
function IntegrationStatus({ data, allClients }: { data: Overview; allClients: boolean }) {
  const connected = integrations.filter(item => data.connections.some(row => row.platform === item.platform && row.status === 'ACTIVE')).length
  return <Card className="p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-foreground">Estado das integrações</h2><p className="mt-0.5 text-xs text-muted-foreground">{allClients ? 'Canais ligados em pelo menos um cliente' : 'Contas ligadas a este cliente'}</p></div><span className="text-[11px] font-semibold text-muted-foreground">{connected} de {integrations.length} canais ligados</span></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-5">{integrations.map(item => {
      const count = data.connections.filter(row => row.platform === item.platform && row.status === 'ACTIVE').length
      return <div key={item.platform} className={cn('flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5', count ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/30')}><item.icon size={15} className="shrink-0" style={{ color: item.color }} /><span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{item.label}</span><span className={cn('shrink-0 text-xs font-bold', count ? 'text-primary' : 'text-muted-foreground')}>{count || '—'}</span></div>
    })}</div></Card>
}
function Chart({ data, metric, source }: { data: Overview; metric: ChartMetric; source: ChartSource }) {
  const series = useMemo(() => {
    const allowed = metric === 'sessions' || metric === 'views' ? ['GOOGLE_ANALYTICS'] : ['META_ADS', 'GOOGLE_ADS']
    const matching = data.reports.filter(report => report.data && allowed.includes(report.platform) && (source === 'all' || source === report.platform))
    const byDate = new Map<string, number>()
    for (const report of matching) for (const day of report.data!.daily) {
      byDate.set(day.date, (byDate.get(day.date) || 0) + Number(day[metric] || 0))
    }
    return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }))
  }, [data, metric, source])
  if (!series.length) return <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-muted-foreground">Sem dados diários disponíveis para este indicador no período selecionado.</div>
  const maximum = Math.max(...series.map(row => row.value), 1) * 1.15
  const x = (index: number) => 16 + index / Math.max(series.length - 1, 1) * 728
  const y = (value: number) => 190 - value / maximum * 165
  const path = series.map((row, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(row.value).toFixed(1)}`).join(' ')
  const area = `${path} L ${x(series.length - 1).toFixed(1)} 190 L 16 190 Z`
  return <div className="min-w-0"><svg viewBox="0 0 760 205" preserveAspectRatio="none" className="h-48 w-full sm:h-64" role="img" aria-label={`${chartMetrics[metric]} por dia`}>
    <defs><linearGradient id="performance-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#00A76F" stopOpacity="0.22" /><stop offset="100%" stopColor="#00A76F" stopOpacity="0" /></linearGradient></defs>
    {[25, 66, 108, 149, 190].map(line => <line key={line} x1="16" x2="744" y1={line} y2={line} className="stroke-border" strokeWidth="1" strokeDasharray="4 5" />)}
    <path d={area} fill="url(#performance-area)" /><path d={path} fill="none" stroke="#00A76F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    {series.length === 1 && <circle cx={x(0)} cy={y(series[0].value)} r="5" fill="#00A76F" />}
  </svg><div className="flex justify-between text-[10px] font-medium text-muted-foreground"><span>{dateLabel(series[0].date)}</span><span>{dateLabel(series[series.length - 1].date)}</span></div></div>
}
function Evolution({ data }: { data: Overview }) {
  const [metric, setMetric] = useState<ChartMetric>('impressions')
  const [source, setSource] = useState<ChartSource>('all')
  const sources = metric === 'sessions' || metric === 'views'
    ? [{ id: 'all' as ChartSource, label: 'Todas as propriedades GA4' }]
    : [{ id: 'all' as ChartSource, label: 'Meta Ads + Google Ads' }, { id: 'META_ADS' as ChartSource, label: 'Meta Ads' }, { id: 'GOOGLE_ADS' as ChartSource, label: 'Google Ads' }]
  return <Card className="min-w-0 p-4 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-base font-bold text-foreground">Evolução da Performance</h2><p className="mt-1 text-xs text-muted-foreground">Dados diários das contas ligadas · {periods[data.range]}</p></div><div className="w-full sm:w-60"><Select value={metric} onValueChange={value => { setMetric(value as ChartMetric); setSource('all') }}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(chartMetrics) as ChartMetric[]).map(key => <SelectItem key={key} value={key}>{chartMetrics[key]}</SelectItem>)}</SelectContent></Select></div></div>
    <div className="-mx-1 mt-5 flex gap-1 overflow-x-auto px-1 pb-2">{sources.map(item => <button key={item.id} type="button" onClick={() => setSource(item.id)} className={cn('shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', source === item.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>{item.label}</button>)}</div>
    <div className="mt-3"><Chart data={data} metric={metric} source={source} /></div>
    <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">{metric === 'impressions' || metric === 'clicks' ? 'Soma das contas de anúncios. Um clique ou impressão pode aparecer em mais de uma plataforma.' : 'Soma das propriedades GA4 ligadas. Cada propriedade usa o respetivo fuso horário.'}</p>
  </Card>
}
function SocialCards({ data, onDetails }: { data: Overview; onDetails: (platform: string) => void }) {
  return <section className="space-y-4"><SectionHeading title="Performance por rede" description="Ligações e publicações registadas no AgencyOS. Métricas orgânicas requerem permissões de analytics adicionais." />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{social.map(item => {
      const accounts = data.connections.filter(row => row.platform === item.platform && row.status === 'ACTIVE')
      const posts = data.posts.filter(post => post.platform === item.platform)
      return <Card key={item.platform} className="flex min-h-[190px] min-w-0 flex-col p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted"><item.icon size={19} style={{ color: item.color }} /></span><h3 className="truncate text-sm font-bold text-foreground">{item.label}</h3></div><Badge variant={accounts.length ? 'success' : 'default'} className="shrink-0 text-[10px]">{accounts.length ? 'Conectado' : 'Não conectado'}</Badge></div>
        <div className="mt-5 grid grid-cols-2 gap-4"><div><p className="text-[11px] text-muted-foreground">Contas ligadas</p><p className="mt-0.5 text-base font-bold text-foreground">{integer(accounts.length)}</p></div><div><p className="text-[11px] text-muted-foreground">Publicações no período</p><p className="mt-0.5 text-base font-bold text-foreground">{integer(posts.length)}</p></div></div>
        <button type="button" onClick={() => onDetails(item.platform)} className="mt-auto self-start rounded pt-5 text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Ver detalhes →</button>
      </Card>
    })}</div></section>
}
function AdsCard({ data, platform }: { data: Overview; platform: 'META_ADS' | 'GOOGLE_ADS' | 'TIKTOK_ADS' | 'LINKEDIN_ADS' }) {
  const isMeta = platform === 'META_ADS'
  const item = integrations.find(entry => entry.platform === platform)!
  const Icon = item.icon
  const page = { META_ADS: '/app/ads', GOOGLE_ADS: '/app/google', TIKTOK_ADS: '/app/tiktok-ads', LINKEDIN_ADS: '/app/linkedin-ads' }[platform]
  const connections = data.connections.filter(row => row.platform === platform && row.status === 'ACTIVE')
  const reports = data.reports.filter(row => row.platform === platform)
  const errors = reports.filter(row => row.error)
  const impressions = total(reports, [platform], 'impressions')
  const clicks = total(reports, [platform], 'clicks')
  const outcomes = total(reports, [platform], isMeta ? 'results' : 'conversions')
  const ctr = impressions && clicks !== null ? percent(clicks / impressions * 100) : impressions === 0 ? '0%' : '—'
  return <Card className="min-w-0 p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={19} /></span><div><h3 className="text-sm font-bold text-foreground">{item.label}</h3><p className="text-xs text-muted-foreground">{connections.length} {connections.length === 1 ? 'conta ligada' : 'contas ligadas'}</p></div></div><Badge variant={errors.length ? 'warning' : connections.length ? 'success' : 'default'}>{errors.length ? 'Atenção' : connections.length ? 'Conectado' : 'Não conectado'}</Badge></div>
    {connections.length ? <><div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-3">{[
      ['Gasto', spendLabel(reports, platform)], ['Impressões', display(impressions)], ['Cliques', display(clicks)],
      ['CTR', ctr], [isMeta ? 'Resultados' : 'Conversões', display(outcomes)],
      [isMeta ? 'Custo por resultado' : 'Custo por conversão', (() => {
        const successful = reports.filter(row => row.data)
        const currencies = new Set(successful.map(row => row.data!.currency || ''))
        if (currencies.size !== 1 || !outcomes) return '—'
        const currency = [...currencies][0]
        const spend = total(reports, [platform], 'spend')
        return currency && spend !== null ? money(spend / outcomes, currency) : '—'
      })()],
    ].map(([label, value]) => <div key={label} className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 break-words text-base font-bold text-foreground">{value}</p></div>)}</div>
      {errors.length > 0 && <p className="mt-4 rounded-lg border border-warning/20 bg-warning/5 p-3 text-xs text-muted-foreground">{errors.length} {errors.length === 1 ? 'conta não pôde ser lida' : 'contas não puderam ser lidas'}. {errors[0].error}</p>}
      {isMeta && <p className="mt-4 text-[11px] text-muted-foreground">“Resultados” segue a ação principal de cada campanha Meta; não representa necessariamente leads.</p>}
    </> : <div className="mt-6 border-t border-border pt-5"><p className="text-sm text-muted-foreground">Ligue uma conta para ver gastos e resultados reais.</p><Link to={page} className="mt-3 inline-flex rounded-lg text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Ir para {item.label} →</Link></div>}
  </Card>
}
function AdsSection({ data }: { data: Overview }) {
  return <section className="space-y-4"><SectionHeading title="Performance de Anúncios" description="Investimento e resultados das contas ligadas. Valores de moedas diferentes são apresentados em separado." /><div className="grid gap-4 lg:grid-cols-2"><AdsCard data={data} platform="META_ADS" /><AdsCard data={data} platform="GOOGLE_ADS" /><AdsCard data={data} platform="TIKTOK_ADS" /><AdsCard data={data} platform="LINKEDIN_ADS" /></div></section>
}
function WebsiteSection({ data }: { data: Overview }) {
  const reports = data.reports.filter(row => row.platform === 'GOOGLE_ANALYTICS')
  const connections = data.connections.filter(row => row.platform === 'GOOGLE_ANALYTICS' && row.status === 'ACTIVE')
  const errors = reports.filter(row => row.error)
  const channels = new Map<string, number>()
  for (const report of reports) for (const channel of report.data?.channels || []) channels.set(channel.label, (channels.get(channel.label) || 0) + channel.sessions)
  const sortedChannels = [...channels].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const sessions = total(reports, ['GOOGLE_ANALYTICS'], 'sessions')
  return <section className="space-y-4"><SectionHeading title="Website / GA4" description="Sessões e eventos dos websites com propriedades Google Analytics ligadas." /><div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]"><Card className="min-w-0 p-4 sm:p-6"><div className="flex items-center gap-2.5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Globe2 size={19} /></span><div><h3 className="text-sm font-bold text-foreground">Visão do website</h3><p className="text-xs text-muted-foreground">Google Analytics 4 · {connections.length} {connections.length === 1 ? 'propriedade' : 'propriedades'}</p></div></div>
    {connections.length ? <><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
      ['Utilizadores ativos', 'users'], ['Sessões', 'sessions'], ['Visualizações', 'views'], ['Eventos principais', 'keyEvents'],
    ].map(([label, key]) => <div key={key} className="min-w-0 rounded-xl border border-border bg-muted/20 p-3.5"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1.5 break-words text-lg font-bold text-foreground">{display(total(reports, ['GOOGLE_ANALYTICS'], key))}</p></div>)}</div>{errors.length > 0 && <p className="mt-4 text-xs text-muted-foreground">{errors.length} {errors.length === 1 ? 'propriedade não pôde ser lida' : 'propriedades não puderam ser lidas'}. {errors[0].error}</p>}</> : <div className="mt-6 border-t border-border pt-5"><p className="text-sm text-muted-foreground">Ligue uma propriedade GA4 para acompanhar o website.</p><Link to="/app/google" className="mt-3 inline-flex text-xs font-bold text-primary hover:underline">Ir para Google Ads & Analytics →</Link></div>}
  </Card><Card className="min-w-0 p-4 sm:p-6"><h3 className="text-sm font-bold text-foreground">Origem do tráfego</h3><p className="mt-1 text-xs text-muted-foreground">Distribuição das sessões GA4</p><div className="mt-5 space-y-4">{sortedChannels.length ? sortedChannels.map(([label, value]) => <div key={label}><div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="truncate font-medium text-foreground">{label}</span><span className="shrink-0 text-muted-foreground">{integer(value)} · {sessions ? percent(value / sessions * 100) : '0%'}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${sessions ? value / sessions * 100 : 0}%` }} /></div></div>) : <p className="text-sm text-muted-foreground">Sem dados de canais disponíveis.</p>}</div></Card></div></section>
}
function RecentPosts({ data }: { data: Overview }) {
  const clients = new Map(data.clients.map(client => [client.id, client.name]))
  const posts = data.posts.slice(0, 4)
  return <section className="space-y-4"><SectionHeading title="Publicações recentes" description="Conteúdos publicados pelo AgencyOS no período selecionado. Alcance orgânico não está disponível nas permissões atuais." />
    {posts.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{posts.map(post => {
      const item = social.find(channel => channel.platform === post.platform)
      const Icon = item?.icon || Activity
      return <Card key={post.id} className="min-w-0 p-4"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-muted"><Icon size={17} style={{ color: item?.color }} /></span><span className="text-xs font-semibold text-muted-foreground">{item?.label || post.platform}</span></div><h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-foreground">{post.title}</h3><p className="mt-3 text-[11px] text-muted-foreground">{clients.get(post.clientId)} · {dateTime(post.publishedAt)}</p>{post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">Ver publicação <ArrowUpRight size={13} /></a>}</Card>
    })}</div> : <Card className="p-6 text-sm text-muted-foreground">Nenhuma publicação feita pelo AgencyOS neste período.</Card>}</section>
}
function AgencyTable({ data }: { data: Overview }) {
  return <section className="space-y-4"><SectionHeading title="Performance dos Clientes" description={`${data.clients.length} clientes da agência · dados das contas ligadas`} /><Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-muted/50"><tr className="text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><th className="px-5 py-3.5">Cliente</th><th className="px-4 py-3.5 text-right">Impressões Ads</th><th className="px-4 py-3.5 text-right">Cliques Ads</th><th className="px-4 py-3.5 text-right">Sessões GA4</th><th className="px-4 py-3.5 text-right">Investimento Ads</th><th className="px-4 py-3.5 text-right">Publicações</th><th className="px-5 py-3.5">Dados</th></tr></thead><tbody>{data.clients.map(client => {
    const reports = data.reports.filter(row => row.clientId === client.id)
    const connections = data.connections.filter(row => row.clientId === client.id && row.status === 'ACTIVE')
    const error = reports.some(row => row.error)
    return <tr key={client.id} className="border-t border-border/70 text-foreground"><td className="whitespace-nowrap px-5 py-4 font-semibold">{client.name}</td><td className="px-4 py-4 text-right">{display(total(reports, adPlatforms, 'impressions'))}</td><td className="px-4 py-4 text-right">{display(total(reports, adPlatforms, 'clicks'))}</td><td className="px-4 py-4 text-right">{display(total(reports, ['GOOGLE_ANALYTICS'], 'sessions'))}</td><td className="whitespace-nowrap px-4 py-4 text-right">{spendLabel(reports)}</td><td className="px-4 py-4 text-right">{integer(data.posts.filter(post => post.clientId === client.id).length)}</td><td className="px-5 py-4"><Badge variant={error ? 'warning' : connections.length ? 'success' : 'default'} className="whitespace-nowrap">{error ? 'Parcial' : connections.length ? 'Disponíveis' : 'Sem ligação'}</Badge></td></tr>
  })}</tbody></table></div></Card></section>
}
function DataStatus({ data }: { data: Overview }) {
  const errors = data.reports.filter(row => row.error)
  const unsynced = data.reports.filter(row => row.platform === 'META_ADS' && row.data?.source === 'synced' && row.data.lastSyncedAt && Date.now() - new Date(row.data.lastSyncedAt).getTime() > 24 * 60 * 60 * 1000)
  return <Card className="p-4 sm:p-6"><div className="flex items-start justify-between gap-2"><div><h2 className="text-base font-bold text-foreground">Estado dos dados</h2><p className="mt-1 text-xs text-muted-foreground">Atualizado em {dateTime(data.generatedAt)}</p></div><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity size={17} /></span></div><div className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
    {errors.length ? errors.map((row, index) => <p key={`${row.connectionId || row.platform}-${index}`} className="rounded-lg border border-border bg-muted/20 p-3">{integrations.find(item => item.platform === row.platform)?.label || row.platform}: {row.error}</p>) : <p>As contas consultadas responderam sem erros.</p>}
    {unsynced.length > 0 && <p className="rounded-lg border border-border bg-muted/20 p-3">{unsynced.length} conta(s) Meta Ads têm dados sincronizados há mais de 24 horas. Use “Atualizar” para sincronizar novamente.</p>}
    <p>As métricas de redes sociais mostram publicações registadas no AgencyOS. O acesso atual destas ligações não inclui analytics orgânicos; alcance, interações e seguidores não são estimados.</p>
  </div></Card>
}

export function PerformancePage() {
  const [clientId, setClientId] = useState('all')
  const [period, setPeriod] = useState<Period>('30d')
  const [tab, setTab] = useState<Tab>('overview')
  const [details, setDetails] = useState<string | null>(null)
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const load = useCallback(async (force = false) => {
    const current = ++requestId.current
    if (force) setRefreshing(true); else { setLoading(true); setData(null) }
    setError(null)
    try {
      const response = await api.get<Overview>('/performance', { params: { clientId, range: period, ...(force ? { refresh: '1' } : {}) } })
      if (current === requestId.current) setData(response.data)
    } catch (reason) {
      if (current === requestId.current) setError(reason instanceof AxiosError ? reason.response?.data?.error || reason.message : 'Não foi possível carregar a performance.')
    } finally {
      if (current === requestId.current) { setLoading(false); setRefreshing(false) }
    }
  }, [clientId, period])
  useEffect(() => { void load() }, [load])

  const allClients = clientId === 'all'
  const selectedClient = data?.clients.find(client => client.id === clientId)
  const kpis: Kpi[] = data ? [
    ...(allClients ? [{ label: 'Clientes', value: integer(data.clients.length), note: 'Clientes registados na agência', icon: Users }] : []),
    { label: 'Impressões Ads', value: display(total(data.reports, adPlatforms, 'impressions')), note: 'Contas de anúncios ligadas', icon: Activity },
    { label: 'Cliques Ads', value: display(total(data.reports, adPlatforms, 'clicks')), note: 'Contas de anúncios ligadas', icon: MousePointerClick },
    { label: 'Sessões GA4', value: display(total(data.reports, ['GOOGLE_ANALYTICS'], 'sessions')), note: 'Websites ligados', icon: Globe2 },
    { label: 'Resultados Meta', value: display(total(data.reports, ['META_ADS'], 'results')), note: 'Ação principal das campanhas', icon: Sparkles },
    { label: 'Conversões Ads', value: display(total(data.reports, ['GOOGLE_ADS', 'TIKTOK_ADS', 'LINKEDIN_ADS'], 'conversions')), note: 'Google + TikTok + LinkedIn', icon: BarChart3 },
    { label: 'Investimento Ads', value: spendLabel(data.reports), note: 'Moedas apresentadas em separado', icon: Wallet },
    { label: 'Publicações', value: integer(data.posts.length), note: 'Publicadas pelo AgencyOS', icon: Megaphone },
  ] : []
  const detailItem = social.find(item => item.platform === details)

  return <div className="mx-auto w-full max-w-[1640px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div className="min-w-0"><div className="mb-2 flex items-center gap-2"><span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity size={18} /></span><Badge variant="primary" className="normal-case">Dados reais</Badge></div><h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-[28px]">Performance</h1><p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">Acompanhe anúncios, websites e publicações dos seus clientes num único lugar.</p></div>
    <div className="grid w-full gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:w-auto xl:grid-cols-[210px_190px_auto] xl:items-end"><div className="min-w-0"><label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Cliente</label><Select value={clientId} onValueChange={setClientId}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{data?.clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div><div className="min-w-0"><label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Período</label><Select value={period} onValueChange={value => setPeriod(value as Period)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(periods) as Period[]).map(key => <SelectItem key={key} value={key}>{periods[key]}</SelectItem>)}</SelectContent></Select></div><Button variant="subtle" className="h-10 w-full sm:self-end" onClick={() => void load(true)} disabled={refreshing || loading}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />Atualizar</Button></div></header>
    {error && <Card className="border-error/30 bg-error/5 p-4 text-sm text-foreground" role="alert">{error} <button type="button" onClick={() => void load()} className="ml-2 font-bold text-primary hover:underline">Tentar novamente</button></Card>}
    {loading && !data ? <Card className="p-8 text-center text-sm text-muted-foreground"><RefreshCw size={18} className="mx-auto mb-3 animate-spin" />A carregar dados das contas ligadas…</Card> : data && <Tabs value={tab} onValueChange={value => setTab(value as Tab)}><TabsList className="flex w-full max-w-full justify-start overflow-x-auto whitespace-nowrap sm:w-auto">{([['overview', 'Visão Geral'], ['social', 'Redes Sociais'], ['ads', 'Publicidade'], ['website', 'Website / GA4']] as [Tab, string][]).map(([id, label]) => <TabsTrigger key={id} value={id} className="shrink-0">{label}</TabsTrigger>)}</TabsList>
      <div className="mt-5 space-y-6"><IntegrationStatus data={data} allClients={allClients} /><section className="space-y-4"><SectionHeading title={allClients ? 'Visão da Agência' : `Indicadores de ${selectedClient?.name || 'cliente'}`} description={`Indicadores das contas ligadas · ${periods[period]}`} /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{kpis.map(item => <KpiCard key={item.label} item={item} />)}</div></section></div>
      <TabsContent value="overview" className="mt-6 space-y-7">{allClients && <AgencyTable data={data} />}<Evolution data={data} /><SocialCards data={data} onDetails={setDetails} /><AdsSection data={data} /><WebsiteSection data={data} /><RecentPosts data={data} /><DataStatus data={data} /></TabsContent>
      <TabsContent value="social" className="mt-6 space-y-7"><SocialCards data={data} onDetails={setDetails} /><RecentPosts data={data} /><DataStatus data={data} /></TabsContent>
      <TabsContent value="ads" className="mt-6 space-y-7"><Evolution data={data} /><AdsSection data={data} /><DataStatus data={data} /></TabsContent>
      <TabsContent value="website" className="mt-6 space-y-7"><WebsiteSection data={data} /><DataStatus data={data} /></TabsContent>
    </Tabs>}
    <Dialog open={!!details} onOpenChange={open => { if (!open) setDetails(null) }}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{detailItem?.label} · detalhes</DialogTitle><DialogDescription>Contas e publicações registadas no AgencyOS.</DialogDescription></DialogHeader>{details && data && <div className="space-y-3"><div className="grid grid-cols-2 gap-3">{[['Contas ligadas', data.connections.filter(row => row.platform === details && row.status === 'ACTIVE').length], ['Publicações no período', data.posts.filter(post => post.platform === details).length]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold text-foreground">{value}</p></div>)}</div><p className="text-xs text-muted-foreground">As permissões atuais de publicação desta rede não incluem métricas orgânicas de alcance, interações ou seguidores.</p><Link to="/app/social" className="inline-flex text-xs font-bold text-primary hover:underline">Gerir ligações →</Link></div>}</DialogContent></Dialog>
  </div>
}
