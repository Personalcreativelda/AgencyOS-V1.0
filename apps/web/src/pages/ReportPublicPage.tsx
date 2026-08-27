import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { XCircle, Zap, Download, TrendingUp, Image as ImageIcon, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { CONTENT_TYPE_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export function ReportPublicPage() {
  const { token } = useParams<{ token: string }>()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-[#fff] border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-dialog">
          <XCircle className="w-12 h-12 text-error mx-auto" />
          <h2 className="text-lg font-extrabold text-slate-800">Relatório Indisponível</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  const recommendations = report.recommendations ? JSON.parse(report.recommendations) : []
  const snapshot = report.snapshot ? JSON.parse(report.snapshot) : {}

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-card { box-shadow: none !important; border: 1px solid #DFE3E8 !important; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Zap size={15} className="text-primary" />
            <span>AgencyOS</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Download size={13} />
            <span>Baixar PDF</span>
          </Button>
        </div>

        {/* Report Card — always a fixed light "document" look, independent of the visitor's app theme */}
        <div className="bg-[#fff] border border-slate-200 rounded-2xl p-5 sm:p-8 space-y-8 shadow-card print-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200">
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider">Relatório Mensal de Performance</p>
              <h1 className="text-2xl font-extrabold text-slate-800 mt-1">{report.title}</h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {report.client?.name} • {new Date(report.periodStart).toLocaleDateString('pt-BR')} até {new Date(report.periodEnd).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Badge variant="success">Publicado</Badge>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-100/70 rounded-xl text-center">
              <p className="text-2xl font-extrabold text-slate-800">{snapshot.contentsPublished ?? 0}</p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">Publicados</p>
            </div>
            <div className="p-4 bg-slate-100/70 rounded-xl text-center">
              <p className="text-2xl font-extrabold text-slate-800">{snapshot.approvalsSent ?? 0}</p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">Enviados p/ Aprovação</p>
            </div>
            <div className="p-4 bg-success/10 rounded-xl text-center">
              <p className="text-2xl font-extrabold text-success-dark">{snapshot.approvedCount ?? 0}</p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">Aprovados</p>
            </div>
            <div className="p-4 bg-warning/10 rounded-xl text-center">
              <p className="text-2xl font-extrabold text-warning-dark">{snapshot.changesRequestedCount ?? 0}</p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">Ajustes Pedidos</p>
            </div>
          </div>

          {/* Summary */}
          {report.summary && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={14} className="text-primary" /> Resumo Executivo
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">{report.summary}</p>
            </div>
          )}

          {/* AI Analysis */}
          {report.aiAnalysis && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={14} className="text-primary" /> Análise de Performance
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-line">{report.aiAnalysis}</p>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Recomendações para o Próximo Período</h2>
              <div className="space-y-2.5">
                {recommendations.map((r: any, i: number) => (
                  <div key={i} className="p-4 bg-slate-100/70 rounded-xl">
                    <p className="text-xs font-bold text-slate-800">{r.title}</p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{r.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Published contents list */}
          {snapshot.contents?.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon size={14} className="text-primary" /> Conteúdos Publicados no Período
              </h2>
              <div className="space-y-1.5">
                {snapshot.contents.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 p-3 bg-slate-100/70 rounded-xl text-xs">
                    <span className="font-bold text-slate-800 truncate min-w-0">{c.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="default">{CONTENT_TYPE_LABELS[c.contentType] || c.contentType}</Badge>
                      <span className="text-slate-500">{new Date(c.publishedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="text-center text-xs text-slate-400 py-4 no-print">
          Gerado com AgencyOS — Sistema Operacional de Agências
        </footer>
      </div>
    </div>
  )
}
