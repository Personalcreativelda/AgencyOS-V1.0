import React, { useEffect, useState } from 'react'
import { Plus, BarChart2, Sparkles, ExternalLink, Copy, Check, Trash2, FileBarChart } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogTitle, DialogFooter, DialogHeader, DialogDescription, DialogIcon } from '@/components/ui/Dialog'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'
import { Page, PageHeader } from '@/components/layout/Page'
import { ListCard, ListSkeleton, listRowClass, Meta } from '@/components/ui/List'
import { cn } from '@/lib/utils'

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
    <Page>
      <PageHeader
        title="Relatórios mensais"
        description="Relatórios de desempenho e métricas com análises geradas pelo Brand Brain."
        actions={
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} />
            <span>Gerar relatório</span>
          </Button>
        }
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="Nenhum relatório gerado"
          description="Gere relatórios mensais para seus clientes com síntese estratégica via Brand Brain."
        />
      ) : (
        <ListCard>
          {reports.map((rep) => (
            <div key={rep.id} className={cn(listRowClass(false), 'flex-wrap sm:flex-nowrap')}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                <FileBarChart size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground">{rep.title}</h3>
                <Meta
                  className="mt-1"
                  items={[
                    <span className="font-medium text-foreground/80">{rep.client?.name}</span>,
                    `${new Date(rep.periodStart).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(rep.periodEnd).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`,
                  ]}
                />
              </div>

              <div className="flex w-full items-center gap-2 pl-14 sm:w-auto sm:pl-0">
                <Badge dot variant="success" className="mr-auto sm:mr-1">Publicado</Badge>
                {rep.publicToken && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleCopyLink(rep.publicToken)} aria-label="Copiar link do relatório">
                      {copiedId === rep.publicToken ? <Check size={14} /> : <Copy size={14} />}
                      <span className="hidden sm:inline">{copiedId === rep.publicToken ? 'Copiado' : 'Copiar link'}</span>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={`/report/${rep.publicToken}`} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} />
                        <span>Abrir</span>
                      </a>
                    </Button>
                  </>
                )}
                <button
                  type="button"
                  title="Excluir relatório"
                  aria-label={`Excluir ${rep.title}`}
                  onClick={() => handleDeleteReport(rep.id, rep.title)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </ListCard>
      )}

      {/* New Report Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader icon={<DialogIcon className="border-transparent bg-primary text-[#fff]"><Sparkles /></DialogIcon>}>
            <DialogTitle>Gerar relatório com Brand Brain</DialogTitle>
            <DialogDescription>Métricas do período com análise e recomendações escritas pelo Brand Brain.</DialogDescription>
          </DialogHeader>

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
              <Label htmlFor="reportTitle">Título do relatório</Label>
              <Input
                id="reportTitle"
                type="text"
                required
                value={newReport.title}
                onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reportStart">Data início</Label>
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
                <Label htmlFor="reportEnd">Data fim</Label>
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
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={creating}>
                Cancelar
              </Button>
              <Button type="submit" loading={creating}>
                {!creating && (
                  <>
                    <Sparkles size={15} />
                    <span>Gerar e publicar</span>
                  </>
                )}
                {creating && <span>Analisando com Brand Brain...</span>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
