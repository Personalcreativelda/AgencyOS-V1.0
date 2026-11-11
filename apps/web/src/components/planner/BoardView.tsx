import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useState } from 'react'
import { ArrowRightLeft, Check, FileText, Plus } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { cn, CONTENT_TYPE_LABELS } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PlatformIcon } from './PlatformIcon'
import { EffectiveBoardColumn, getPrimaryImage } from './plannerUtils'

interface BoardViewProps {
  contents: any[]
  columns: EffectiveBoardColumn[]
  onOpenContent: (id: string) => void
  /** Optional: "+" in a column header opens the create flow. */
  onCreate?: () => void
  /** Move a card to another column (tap alternative to drag & drop — works on touch screens). */
  onMove?: (content: any, targetStatus: string) => void
}

// Column dot colour by the status it represents (Stitch Kanban).
const STATUS_DOT: Record<string, string> = {
  IDEA: 'bg-grey-500', DRAFT: 'bg-grey-500', IN_PRODUCTION: 'bg-info', INTERNAL_REVIEW: 'bg-secondary',
  CLIENT_REVIEW: 'bg-warning', CHANGES_REQUESTED: 'bg-error', APPROVED: 'bg-success', SCHEDULED: 'bg-primary',
  PUBLISHED: 'bg-primary-dark', FAILED: 'bg-error', ARCHIVED: 'bg-grey-400',
}

/** Kanban card: client chip, title, thumbnail, date + format, networks. Same drag behaviour as before. */
function KanbanCard({ content, onClick, showStatus, columns, currentKey, onMove }: {
  content: any; onClick: () => void; showStatus: boolean
  columns: EffectiveBoardColumn[]; currentKey: string; onMove?: (content: any, targetStatus: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: content.id, data: { content } })
  const image = getPrimaryImage(content)
  const when = content.scheduledAt
    ? new Date(content.scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  const platforms: string[] = (content.platforms || []).map((p: any) => p.platform)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={cn(
        'group cursor-grab rounded-2xl border border-border/70 bg-card p-3.5 shadow-card transition-[border-color,box-shadow] hover:border-grey-400 hover:shadow-card-hover active:cursor-grabbing',
        isDragging && 'z-50 opacity-40'
      )}
      title={content.title}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="max-w-[70%] truncate rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary-dark dark:text-primary-light">
          {content.client?.name || 'Cliente'}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {/* The column already names the status — only show it when a column groups several. */}
          {showStatus && <StatusBadge status={content.status} className="gap-1 px-1.5 py-0 text-[11px] leading-4" />}
          {onMove && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Mover "${content.title}" para outra coluna`}
                  title="Mover para…"
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="-mr-1.5 -mt-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowRightLeft size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                {columns.filter((c) => !c.hidden).map((c) => (
                  <DropdownMenuItem key={c.key} disabled={c.key === currentKey} onSelect={() => onMove(content, c.targetStatus)}>
                    <span aria-hidden className={cn('size-2 rounded-full', STATUS_DOT[c.targetStatus] || 'bg-grey-500')} />
                    <span className="flex-1">{c.label}</span>
                    {c.key === currentKey && <Check size={14} className="text-muted-foreground" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{content.title}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {when && <span className="tabular-nums">{when}</span>}
            <span className="rounded bg-muted px-1.5 py-px text-[11px]">{CONTENT_TYPE_LABELS[content.contentType] || content.contentType}</span>
          </p>
        </div>
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted">
          {image ? <img src={image.publicUrl} alt="" loading="lazy" className="size-full object-cover" /> : <FileText size={18} className="text-muted-foreground" />}
        </div>
      </div>

      {platforms.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-border/70 pt-2.5">
          {platforms.map((p) => (
            <span key={p} className="flex size-6 items-center justify-center rounded-md bg-muted/70"><PlatformIcon platform={p} size={13} /></span>
          ))}
        </div>
      )}
    </div>
  )
}

function BoardColumn({ column, items, onOpenContent, onCreate, columns, onMove, fullWidth = false }: {
  column: EffectiveBoardColumn; items: any[]; onOpenContent: (id: string) => void; onCreate?: () => void
  columns: EffectiveBoardColumn[]; onMove?: (content: any, targetStatus: string) => void; fullWidth?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${column.targetStatus}` })

  return (
    <section
      aria-label={`${column.label}: ${items.length}`}
      className={cn(
        'flex shrink-0 snap-start flex-col rounded-[20px] border border-border/70 bg-muted/40 p-2.5 transition-colors',
        fullWidth ? 'w-full' : 'w-[min(85vw,300px)] sm:w-[300px]',
        isOver && 'border-primary/40 bg-primary/5'
      )}
    >
      <header className="flex items-center gap-2 px-1.5 pb-3 pt-1.5">
        <span aria-hidden className={cn('size-2.5 rounded-full', STATUS_DOT[column.targetStatus] || 'bg-grey-500')} />
        <h3 className="truncate text-[15px] font-semibold text-foreground">{column.label}</h3>
        <span className="rounded-md bg-card px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{items.length}</span>
        {onCreate && (
          <button type="button" onClick={onCreate} aria-label={`Novo conteúdo em ${column.label}`}
            className="ml-auto flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
            <Plus size={16} />
          </button>
        )}
      </header>
      <div ref={setNodeRef} className="flex min-h-[220px] flex-1 flex-col gap-2.5">
        {items.map((item) => (
          <KanbanCard key={item.id} content={item} onClick={() => onOpenContent(item.id)} showStatus={column.statuses.length > 1} columns={columns} currentKey={column.key} onMove={onMove} />
        ))}
        {items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border py-8 text-center text-[13px] text-muted-foreground">Sem conteúdos</p>
        )}
      </div>
    </section>
  )
}

export function BoardView({ contents, columns, onOpenContent, onCreate, onMove }: BoardViewProps) {
  const visible = columns.filter((c) => !c.hidden)
  const itemsFor = (column: EffectiveBoardColumn) => contents.filter((c) => column.statuses.includes(c.status))
  // Phones: one column at a time, picked from status tabs (like a native "funnel" screen);
  // tablets and desktop keep the side-by-side board with drag & drop.
  const phone = useMediaQuery('(max-width: 767px)')
  const [activeKey, setActiveKey] = useState<string>(() => (visible.find((c) => itemsFor(c).length) || visible[0])?.key)
  useEffect(() => {
    if (!visible.some((c) => c.key === activeKey)) setActiveKey(visible[0]?.key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns])

  if (phone) {
    const active = visible.find((c) => c.key === activeKey) || visible[0]
    if (!active) return null
    return (
      <div className="space-y-3">
        <div role="tablist" aria-label="Colunas do Kanban" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visible.map((c) => {
            const on = c.key === active.key
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActiveKey(c.key)}
                className={cn(
                  'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
                  on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground',
                )}
              >
                <span aria-hidden className={cn('size-2 rounded-full', STATUS_DOT[c.targetStatus] || 'bg-grey-500')} />
                {c.label}
                <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', on ? 'bg-background/20' : 'bg-muted')}>{itemsFor(c).length}</span>
              </button>
            )
          })}
        </div>
        <BoardColumn column={active} items={itemsFor(active)} onOpenContent={onOpenContent} onCreate={onCreate} columns={visible} onMove={onMove} fullWidth />
      </div>
    )
  }

  return (
    <div className="flex snap-x snap-mandatory scroll-px-4 items-start gap-4 overflow-x-auto pb-3">
      {visible.map((column) => (
        <BoardColumn
          key={column.key}
          column={column}
          items={itemsFor(column)}
          onOpenContent={onOpenContent}
          onCreate={onCreate}
          columns={visible}
          onMove={onMove}
        />
      ))}
    </div>
  )
}
