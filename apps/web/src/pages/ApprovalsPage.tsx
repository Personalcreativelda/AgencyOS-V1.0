import { useEffect, useState } from 'react'
import { CheckSquare, ExternalLink, MessageSquareWarning, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'
import { Page, PageHeader } from '@/components/layout/Page'
import { ListCard, ListSkeleton, listRowClass, Meta } from '@/components/ui/List'
import { cn } from '@/lib/utils'

export function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/approvals')
        setApprovals(data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleDelete = async (id: string, title: string) => {
    const ok = await confirmDialog({
      title: 'Excluir este link de aprovação?',
      description: `O histórico do link enviado para "${title}" será removido. O conteúdo em si não é afetado.`,
      variant: 'destructive',
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    const prev = approvals
    setApprovals((as) => as.filter((a) => a.id !== id))
    try {
      await api.delete(`/approvals/${id}`)
    } catch (err) {
      setApprovals(prev)
      toast.error('Erro ao excluir link de aprovação', getErrorMessage(err))
    }
  }

  return (
    <Page>
      <PageHeader
        title="Aprovações"
        description="Histórico e status dos links públicos de aprovação enviados aos clientes."
      />

      {loading ? (
        <ListSkeleton rows={4} thumb={false} />
      ) : approvals.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nenhuma aprovação solicitada ainda"
          description='Abra qualquer conteúdo no Workspace e clique em "Link de aprovação" para enviar ao cliente.'
        />
      ) : (
        <ListCard>
          {approvals.map((appr) => {
            const lastAction = appr.actions?.[0]
            return (
              <div key={appr.id} className={cn(listRowClass(false), 'flex-col items-stretch gap-3 sm:gap-3')}>
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-foreground">{appr.content?.title || 'Conteúdo removido'}</h3>
                    <Meta
                      className="mt-1"
                      items={[
                        <span className="font-medium text-foreground/80">{appr.client?.name}</span>,
                        `Enviado em ${new Date(appr.sentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`,
                      ]}
                    />
                  </div>

                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <StatusBadge status={appr.status} className="mr-auto sm:mr-1" />
                    <Button asChild variant="outline" size="sm">
                      <a href={`/approval/${appr.token}`} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} />
                        <span>Ver portal</span>
                      </a>
                    </Button>
                    <button
                      type="button"
                      title="Excluir link de aprovação"
                      aria-label="Excluir link de aprovação"
                      onClick={() => handleDelete(appr.id, appr.content?.title || '')}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {appr.status === 'CHANGES_REQUESTED' && lastAction?.comment && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.06] px-3.5 py-3">
                    <MessageSquareWarning size={15} className="mt-0.5 shrink-0 text-warning-dark dark:text-warning" />
                    <div className="min-w-0 text-[13px]">
                      <span className="font-semibold text-foreground">{lastAction.actorName || 'Cliente'} pediu ajustes</span>
                      <p className="mt-0.5 text-foreground/75">“{lastAction.comment}”</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </ListCard>
      )}
    </Page>
  )
}
