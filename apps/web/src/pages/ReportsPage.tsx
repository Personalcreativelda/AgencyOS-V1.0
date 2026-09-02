import React, { useEffect, useState } from 'react'
import { Plus, BarChart2, Sparkles, ExternalLink, Copy, Check, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'

export function ReportsPage() {
  const [reports, setReports] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // New Report Modal
  const [showModal, setShowModal] = useState(false)
  const [newReport, setNewReport] = useState({
    clientId: '',
    title: '',
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => {
    async function load() {
      try {
        const [repRes, cliRes] = await Promise.all([
          api.get('/reports'),
          api.get('/clients'),
        ])
        setReports(repRes.data || [])
        setClients(cliRes.data.data || [])
        if (cliRes.data.data?.length > 0 && !newReport.clientId) {
          setNewReport((prev) => ({
            ...prev,
            clientId: cliRes.data.data[0].id,
            title: `Relatório Mensal — ${cliRes.data.data[0].name}`,
          }))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newReport.clientId || !newReport.title) return
    setCreating(true)
    try {
      const { data } = await api.post('/reports', newReport)
      const pubRes = await api.post(`/reports/${data.id}/publish`)
      setReports([pubRes.data, ...reports])
      setShowModal(false)
    } catch (err) {
      toast.error('Erro ao gerar relatório', getErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const handleCopyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/report/${token}`)
    setCopiedId(token)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDeleteReport = async (id: string, title: string) => {
    const ok = await confirmDialog({
      title: 'Excluir este relatório?',
      description: `"${title}" será removido definitivamente. Se o link já foi enviado ao cliente, ele deixa de funcionar.`,
      variant: 'destructive',
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    const prev = reports
    setReports((rs) => rs.filter((r) => r.id !== id))
    try {
      await api.delete(`/reports/${id}`)
      toast.success('Relatório excluído.')
    } catch (err) {
      setReports(prev)
      toast.error('Erro ao excluir relatório', getErrorMessage(err))
    }
  }

  const handleClientChange = (clientId: string) => {
    const c = clients.find((item) => item.id === clientId)
    setNewReport({
      ...newReport,
      clientId,
      title: `Relatório Mensal — ${c?.name || ''}`,
    })
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Relatórios Mensais</h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Relatórios de desempenho e métricas com análises geradas por IA.
          </p>
        </div>

        <Button onClick={() => setShowModal(true)} className="self-start">
          <Plus size={16} />
          <span>Gerar Novo Relatório</span>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="Nenhum relatório gerado"
          description="Gere relatórios mensais para seus clientes com síntese estratégica via IA."
        />
      ) : (
        <div className="space-y-3.5">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className="card-minimals-hover p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-bold text-primary truncate max-w-[200px]">{rep.client?.name}</span>
                  <span className="text-xs text-muted-foreground/60">•</span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Período: {new Date(rep.periodStart).toLocaleDateString('pt-BR')} até {new Date(rep.periodEnd).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-foreground">{rep.title}</h3>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="success">Publicado</Badge>

                {rep.publicToken && (
                  <>
                    <Button
                      variant="subtle"
                      onClick={() => handleCopyLink(rep.publicToken)}
                      className="gap-1.5"
                    >
                      {copiedId === rep.publicToken ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedId === rep.publicToken ? 'Copiado!' : 'Copiar Link'}</span>
                    </Button>

                    <Button asChild className="gap-1.5">
                      <a href={`/report/${rep.publicToken}`} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} />
                        <span>Ver Relatório</span>
                      </a>
                    </Button>
                  </>
                )}

                <button
                  type="button"
                  title="Excluir relatório"
                  onClick={() => handleDeleteReport(rep.id, rep.title)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-error hover:bg-error/10 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Report Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogTitle>Gerar Relatório com IA</DialogTitle>

          <form onSubmit={handleCreateReport} className="space-y-4">
            <div>
              <Label htmlFor="reportClient">Cliente *</Label>
              <Select required value={newReport.clientId} onValueChange={handleClientChange}>
                <SelectTrigger id="reportClient">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reportTitle">Título do Relatório</Label>
              <Input
                id="reportTitle"
                type="text"
                required
                value={newReport.title}
                onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="reportStart">Data Início</Label>
                <Input
                  id="reportStart"
                  type="date"
                  required
                  value={newReport.periodStart}
                  onChange={(e) => setNewReport({ ...newReport, periodStart: e.target.value })}
                  className="px-3 py-2"
                />
              </div>

              <div>
                <Label htmlFor="reportEnd">Data Fim</Label>
                <Input
                  id="reportEnd"
                  type="date"
                  required
                  value={newReport.periodEnd}
                  onChange={(e) => setNewReport({ ...newReport, periodEnd: e.target.value })}
                  className="px-3 py-2"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowModal(false)} disabled={creating}>
                Cancelar
              </Button>
              <Button type="submit" loading={creating}>
                {!creating && (
                  <>
                    <Sparkles size={15} />
                    <span>Gerar e Publicar</span>
                  </>
                )}
                {creating && <span>Analisando com IA...</span>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
