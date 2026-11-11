import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, CheckSquare, Clock, ExternalLink, MessageSquareWarning, Percent, Send, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import api, { cachedGet } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'
import { Page, PageHeader } from '@/components/layout/Page'
import { ListCard, ListSkeleton, listRowClass, Meta } from '@/components/ui/List'
import { cn } from '@/lib/utils'
import { Stat, StatGroup } from '@/components/ui/Stat'
import { FilterBar } from '@/components/ui/FilterPills'

type Filter = 'all' | 'PENDING' | 'CHANGES_REQUESTED' | 'APPROVED'
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

export function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [inReview, setInReview] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    async function load() {
      try {
        // Contents marked "Aguardando cliente" are what the nav badge counts — load them too, so a
        // piece moved to that status without a link sent still shows up here.
        const [appr, review] = await Promise.all([
          cachedGet('/approvals'),
          cachedGet('/contents', { params: { status: 'CLIENT_REVIEW', limit: 50 } }).catch(() => ({ data: { data: [] } })),
        ])
        setApprovals(appr.data || [])
        setInReview(review.data?.data || [])
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

  const withoutLink = inReview.filter((c) => !approvals.some((a) => (a.content?.id || a.contentId) === c.id && a.status === 'PENDING'))
  const withoutLinkCard = withoutLink.length > 0 && (
    <section className="overflow-hidden rounded-[20px] border border-warning/30 bg-warning/[0.05]">
      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <Send size={17} className="mt-0.5 shrink-0 text-warning-dark dark:text-warning" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Aguardando cliente, sem link enviado</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{withoutLink.length === 1 ? 'Este conteúdo está' : `Estes ${withoutLink.length} conteúdos estão`} como "Aguardando cliente", mas o cliente ainda não recebeu um link de aprovação.</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-warning/20 border-t border-warning/20">
        {withoutLink.map((c) => (
          <li key={c.id}>
            <Link to={`/app/content/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-warning/[0.06] sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{c.title}</p>
                <p className="truncate text-xs text-muted-foreground">{c.client?.name}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary-dark dark:text-primary">Enviar link<ArrowRight size={14} /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )

  const count = (st: string) => approvals.filter((a) => a.status === st).length
  const pending = count('PENDING')
  const changes = count('CHANGES_REQUESTED')
  const approved = count('APPROVED')
  const decided = approvals.filter((a) => a.status !== 'PENDING').length
  const rate = decided ? Math.round((approved / decided) * 100) : null
  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Todas', count: approvals.length },
    { key: 'PENDING', label: 'Pendentes', count: pending },
    { key: 'CHANGES_REQUESTED', label: 'Ajustes pedidos', count: changes },
    { key: 'APPROVED', label: 'Aprovadas', count: approved },
  ]
  const q = query.trim().toLowerCase()
  const visible = approvals.filter((a) =>
    (filter === 'all' || a.status === filter) &&
    (!q || `${a.content?.title || ''} ${a.client?.name || ''}`.toLowerCase().includes(q)))

  return (
    <Page>
      <PageHeader
        title="Aprovações"
        description="Histórico e status dos links públicos de aprovação enviados aos clientes."
      />

      {loading ? (
        <ListSkeleton rows={4} thumb={false} />
      ) : approvals.length === 0 ? (<>
        {withoutLinkCard}
        <EmptyState
          icon={CheckSquare}
          title={withoutLink.length ? 'Nenhum link de aprovação enviado' : 'Nenhuma aprovação solicitada ainda'}
          description={withoutLink.length ? 'Os links que enviar aparecem aqui, com o estado de cada resposta do cliente.' : 'Abra qualquer conteúdo no Workspace e clique em "Link de aprovação" para enviar ao cliente.'}
          action={withoutLink.length ? undefined : <Button asChild variant="outline"><Link to="/app/content">Ir para Conteúdos<ArrowRight size={15} /></Link></Button>}
        />
      </>
      ) : (<>
        <StatGroup>
          <Stat label="Aguardando cliente" value={pending} icon={Clock} tone={pending ? 'warning' : 'default'} />
          <Stat label="Ajustes pedidos" value={changes} icon={MessageSquareWarning} tone={changes ? 'error' : 'default'} />
          <Stat label="Aprovadas" value={approved} icon={CheckCircle2} tone="success" />
          <Stat label="Taxa de aprovação" value={rate === null ? '—' : `${rate}%`} icon={Percent} hint="Aprovadas entre as respondidas" />
        </StatGroup>

        {withoutLinkCard}

        <FilterBar pills={tabs} value={filter} onChange={setFilter} query={query} onQuery={setQuery} placeholder="Pesquisar conteúdo ou cliente" label="Filtrar por estado" />

        {visible.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-border py-10 text-center text-sm text-muted-foreground">Nenhuma aprovação corresponde a este filtro.</p>
        ) : (
        <ListCard>
          {visible.map((appr) => {
            const lastAction = appr.actions?.[0]
            const expired = appr.status === 'PENDING' && appr.expiresAt && new Date(appr.expiresAt) < new Date()
            return (
              <div key={appr.id} className={cn(listRowClass(false), 'flex-col items-stretch gap-3 sm:gap-3')}>
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-foreground">{appr.content?.title || 'Conteúdo removido'}</h3>
                    <Meta
                      className="mt-1"
                      items={[
                        <span className="font-medium text-foreground/80">{appr.client?.name}</span>,
                        `Enviado em ${new Date(appr.sentAt || appr.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`,
                        appr.status === 'PENDING' && (appr.viewedAt ? `Visto em ${fmtDate(appr.viewedAt)}` : 'Ainda não aberto'),
                        appr.status === 'PENDING' && appr.expiresAt && (expired
                          ? <span className="font-medium text-error-dark dark:text-error">Link expirado</span>
                          : `Expira em ${fmtDate(appr.expiresAt)}`),
                      ].filter(Boolean)}
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
      </>)}
    </Page>
  )
}
