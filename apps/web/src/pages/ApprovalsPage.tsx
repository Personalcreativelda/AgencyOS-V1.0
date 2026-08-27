import { useEffect, useState } from 'react'
import { CheckSquare, ExternalLink, MessageSquareWarning } from 'lucide-react'
import api from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

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

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Links de Aprovação do Cliente</h1>
        <p className="text-xs text-muted-foreground font-medium mt-1">
          Histórico e status dos links públicos de aprovação enviados aos clientes.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nenhuma aprovação solicitada ainda"
          description='Abra qualquer conteúdo no Workspace e clique em "Link de Aprovação" para enviar ao cliente.'
        />
      ) : (
        <div className="space-y-3">
          {approvals.map((appr) => {
            const lastAction = appr.actions?.[0]
            return (
              <div key={appr.id} className="card-minimals-hover p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-xs font-bold text-primary truncate max-w-[200px]">{appr.client?.name}</span>
                      <span className="text-xs text-muted-foreground/60">•</span>
                      <span className="text-xs text-muted-foreground font-medium">Enviado em {new Date(appr.sentAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{appr.content?.title}</h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={appr.status} />

                    <Button asChild variant="subtle" className="gap-1.5">
                      <a href={`/approval/${appr.token}`} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} />
                        <span>Ver Portal do Cliente</span>
                      </a>
                    </Button>
                  </div>
                </div>

                {appr.status === 'CHANGES_REQUESTED' && lastAction?.comment && (
                  <div className="p-3.5 bg-warning/10 border border-warning/20 rounded-xl flex items-start gap-2.5">
                    <MessageSquareWarning size={16} className="text-warning-dark shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold text-warning-dark">
                        {lastAction.actorName || 'Cliente'} pediu ajustes:
                      </span>
                      <p className="text-grey-700 mt-0.5 italic">"{lastAction.comment}"</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
