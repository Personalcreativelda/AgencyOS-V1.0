import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { ContentCard } from './ContentCard'
import { EffectiveBoardColumn } from './plannerUtils'

interface BoardViewProps {
  contents: any[]
  columns: EffectiveBoardColumn[]
  onOpenContent: (id: string) => void
}

function BoardColumn({ column, items, onOpenContent }: { column: EffectiveBoardColumn; items: any[]; onOpenContent: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${column.targetStatus}` })

  return (
    <div className="flex flex-col w-[85vw] sm:w-72 shrink-0 snap-start">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs font-bold text-foreground">{column.label}</span>
        <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 p-2 rounded-2xl bg-muted/40 border border-border min-h-[200px] transition-colors',
          isOver && 'bg-primary/5 border-primary/30'
        )}
      >
        {items.map((item) => (
          <ContentCard key={item.id} content={item} onClick={() => onOpenContent(item.id)} />
        ))}
        {items.length === 0 && (
          <p className="text-[11px] text-muted-foreground/60 italic text-center py-6">Sem conteúdos</p>
        )}
      </div>
    </div>
  )
}

export function BoardView({ contents, columns, onOpenContent }: BoardViewProps) {
  return (
    <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-px-4">
      {columns.map((column) => (
        <BoardColumn
          key={column.key}
          column={column}
          items={contents.filter((c) => column.statuses.includes(c.status))}
          onOpenContent={onOpenContent}
        />
      ))}
    </div>
  )
}
