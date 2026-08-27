import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { isSameDay, isToday } from 'date-fns'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContentCard } from './ContentCard'
import { DayAgendaDialog } from './DayAgendaDialog'
import { getWeekRange, dateKey, capitalize } from './plannerUtils'
import { useMediaQuery } from '@/hooks/useMediaQuery'

const MAX_VISIBLE = 6

interface WeekViewProps {
  currentDate: Date
  contents: any[]
  onOpenContent: (id: string) => void
  onCreateAt: (date: Date) => void
}

function DayColumn({
  date, items, onOpenContent, onCreateAt, onExpand,
}: {
  date: Date
  items: any[]
  onOpenContent: (id: string) => void
  onCreateAt: (date: Date) => void
  onExpand: (date: Date) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dateKey(date)}` })
  const today = isToday(date)
  const visible = items.slice(0, MAX_VISIBLE)
  const hidden = items.length - visible.length

  return (
    <div
      ref={setNodeRef}
      className={cn('group flex-1 min-w-[150px] border-r border-border last:border-r-0 p-2 space-y-2', isOver && 'bg-primary/5')}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
        </p>
        <span className={cn(
          'w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold',
          today ? 'bg-primary text-[#fff]' : 'text-foreground'
        )}>
          {date.getDate()}
        </span>
      </div>

      <div className="space-y-1.5 min-h-[60px]">
        {visible.map((item) => (
          <ContentCard key={item.id} content={item} onClick={() => onOpenContent(item.id)} />
        ))}
        {items.length === 0 && (
          <button
            type="button"
            onClick={() => onCreateAt(date)}
            className="w-full flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-transparent group-hover:text-muted-foreground py-4 border border-dashed border-transparent group-hover:border-border rounded-xl transition-colors"
          >
            <Plus size={13} />
            <span>Criar conteúdo</span>
          </button>
        )}
      </div>

      {hidden > 0 && (
        <button type="button" onClick={() => onExpand(date)} className="w-full text-[10px] font-bold text-primary hover:underline text-left">
          +{hidden} mais
        </button>
      )}
    </div>
  )
}

export function WeekView({ currentDate, contents, onOpenContent, onCreateAt }: WeekViewProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [expandedDay, setExpandedDay] = useState<Date | null>(null)
  const { days } = getWeekRange(currentDate)

  const itemsByDay = (date: Date) =>
    contents
      .filter((c) => c.scheduledAt && isSameDay(new Date(c.scheduledAt), date))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

  if (!isDesktop) {
    const daysWithContent = days.filter((d) => itemsByDay(d).length > 0)
    return (
      <div className="space-y-4">
        {daysWithContent.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-10">Nenhum conteúdo agendado nesta semana.</p>
        ) : (
          daysWithContent.map((date) => (
            <div key={dateKey(date)} className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {capitalize(date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }))}
              </p>
              <div className="space-y-1.5">
                {itemsByDay(date).map((item) => (
                  <ContentCard key={item.id} content={item} onClick={() => onOpenContent(item.id)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <div className="flex border-t border-l border-border overflow-x-auto">
      {days.map((date) => (
        <DayColumn
          key={dateKey(date)}
          date={date}
          items={itemsByDay(date)}
          onOpenContent={onOpenContent}
          onCreateAt={onCreateAt}
          onExpand={setExpandedDay}
        />
      ))}

      <DayAgendaDialog
        date={expandedDay}
        items={expandedDay ? itemsByDay(expandedDay) : []}
        onClose={() => setExpandedDay(null)}
        onOpenContent={onOpenContent}
        onCreateAt={(d) => { setExpandedDay(null); onCreateAt(d) }}
      />
    </div>
  )
}
