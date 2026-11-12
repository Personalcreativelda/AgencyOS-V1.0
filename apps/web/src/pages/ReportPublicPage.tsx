import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { XCircle, Download, TrendingUp, TrendingDown, Image as ImageIcon, CheckCircle2, Target, Megaphone } from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'
import api from '@/lib/api'
import { CONTENT_TYPE_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ReportAdsSection } from '@/components/reports/ReportAdsSection'
import { MadeBy } from '@/components/brand/MadeBy'
import { isNativeApp, saveElementAsPdf } from '@/lib/savePdf'
import { toast } from '@/lib/toast'

function GrowthBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null
  const positive = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${positive ? 'text-success-dark' : 'text-error-dark'}`}>
      {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {positive ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

export function ReportPublicPage() {
  const { token } = useParams<{ token: string }>()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  // Browser: print dialog ("Guardar como PDF", selectable text). Android app: the WebView has no
  // print dialog, so the PDF is generated here and saved to the phone.
  const download = async () => {
    if (!isNativeApp()) { window.print(); return }
    if (!reportRef.current || saving) return
    setSaving(true)
    try {
      const { savedTo } = await saveElementAsPdf(reportRef.current, report?.title || 'Relatório')
      toast.success(savedTo ? `Relatório guardado em ${savedTo}` : 'Relatório pronto para partilhar')
    } catch {
      toast.error('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/reports/public/${token}`)
        setReport(data)
      } catch (err: any) {
        setError(err.response?.data?.error || 'Relatório não encontrado ou ainda não publicado.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-dialog">
          <XCircle className="w-12 h-12 text-error mx-auto" />
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Relatório indisponível</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  const recommendations = report.recommendations ? JSON.parse(report.recommendations) : []
  const snapshot = report.snapshot ? JSON.parse(report.snapshot) : {}

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-card { --card: 0 0% 100%; --foreground: 210 24% 16%; --muted: 210 20% 96%; --muted-foreground: 210 10% 42%; --border: 214 15% 87%; color-scheme: light; color: hsl(var(--foreground)); background: white !important; }
          .print-card { box-shadow: none !important; border: 1px solid #DFE3E8 !important; }
          .print-avoid-break { break-inside: avoid; }
        }
        .pdf-export .print-card { --card: 0 0% 100%; --foreground: 210 24% 16%; --muted: 210 20% 96%; --muted-foreground: 210 10% 42%; --border: 214 15% 87%; color-scheme: light; color: hsl(var(--foreground)); background: white !important; box-shadow: none !important; }
        .pdf-export .print-card .no-print { display: none !important; }
      `}</style>

      <div className="mx-auto max-w-3xl space-y-6 p-4 pb-28 pt-[calc(var(--sat)+1rem)] sm:p-8 sm:pb-28 sm:pt-[calc(var(--sat)+2rem)]">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground no-print">
          <LogoMark size={20} />
          <span>AgencyOS</span>
        </div>

        {/* Report follows the site palette on screen; print uses an explicit light palette */}
        <div ref={reportRef} className="bg-card border border-border rounded-2xl p-5 sm:p-8 space-y-8 shadow-card print-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-border">
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider">Relatório Mensal de Performance</p>
              <h1 className="text-2xl font-bold text-foreground mt-1">{report.title}</h1>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                {report.client?.name} • {new Date(report.periodStart).toLocaleDateString('pt-BR')} até {new Date(report.periodEnd).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Badge variant="success">Publicado</Badge>
          </div>

          {/* Goal */}
          {snapshot.goal && (
            <div className="flex items-start gap-2.5 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <Target size={16} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Meta Definida</p>
                <p className="text-sm text-foreground/85 font-medium mt-0.5">{snapshot.goal}</p>
              </div>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/70 rounded-xl text-center">
              <p className="text-2xl font-bold text-foreground">{snapshot.contentsPublished ?? 0}</p>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Publicados</p>
            </div>
            <div className="p-4 bg-muted/70 rounded-xl text-center">
              <p className="text-2xl font-bold text-foreground">{snapshot.approvalsSent ?? 0}</p>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Enviados p/ Aprovação</p>
            </div>
            <div className="p-4 bg-success/10 rounded-xl text-center">
              <p className="text-2xl font-bold text-success-dark">{snapshot.approvedCount ?? 0}</p>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Aprovados</p>
            </div>
            <div className="p-4 bg-warning/10 rounded-xl text-center">
              <p className="text-2xl font-bold text-warning-dark">{snapshot.changesRequestedCount ?? 0}</p>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Ajustes Pedidos</p>
            </div>
          </div>

          {/* Ads (Meta Ads) — only shown when this client has a connected ad account */}
          {snapshot.ads && (
            <ReportAdsSection ads={snapshot.ads} growth={snapshot.adsGrowth} currency={snapshot.ads.currency || report.adsCurrency || 'BRL'} />
          )}

          {/* Summary */}
          {report.summary && (
            <div className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <CheckCircle2 size={14} className="text-primary" /> Resumo Executivo
              </h2>
              <p className="text-sm text-foreground/85 leading-relaxed font-medium">{report.summary}</p>
            </div>
          )}

          {/* AI Analysis */}
          {report.aiAnalysis && (
            <div className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <TrendingUp size={14} className="text-primary" /> Análise de Performance
              </h2>
              <p className="text-sm text-foreground/85 leading-relaxed font-medium whitespace-pre-line">{report.aiAnalysis}</p>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recomendações para o próximo período</h2>
              <div className="space-y-2.5">
                {recommendations.map((r: any, i: number) => (
                  <div key={i} className="p-4 bg-muted/70 rounded-xl">
                    <p className="text-xs font-bold text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Published contents list */}
          {snapshot.contents?.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ImageIcon size={14} className="text-primary" /> Conteúdos Publicados no Período
              </h2>
              <div className="space-y-1.5">
                {snapshot.contents.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 p-3 bg-muted/70 rounded-xl text-xs">
                    <span className="font-bold text-foreground truncate min-w-0">{c.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="default">{CONTENT_TYPE_LABELS[c.contentType] || c.contentType}</Badge>
                      <span className="text-muted-foreground">{new Date(c.publishedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="py-4 no-print">
          <MadeBy />
        </footer>
      </div>

      {/* Download where the thumb is: bottom bar, above the gesture area */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur-md no-print" style={{ paddingBottom: 'var(--sab)' }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <p className="hidden min-w-0 truncate text-[13px] text-muted-foreground sm:block">{report.title}</p>
          <Button onClick={download} loading={saving} className="w-full gap-2 sm:w-auto">
            {!saving && <Download size={16} aria-hidden />}
            {saving ? 'A gerar PDF…' : 'Baixar relatório em PDF'}
          </Button>
        </div>
      </div>
    </div>
  )
}
