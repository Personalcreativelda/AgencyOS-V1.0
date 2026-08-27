import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { isSameMonth, isSameDay, isToday } from 'date-fns'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContentCard } from './ContentCard'
import { DayAgendaDialog } from './DayAgendaDialog'
import { getMonthGridRange, dateKey, capitalize } from './plannerUtils'
import { useMediaQuery } from '@/hooks/useMediaQuery'

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MAX_VISIBLE = 3

interface CalendarMonthViewProps {
  currentDate: Date
  contents: any[]
  onOpenContent: (id: string) => void
  onCreateAt: (date: Date) => void
}

function DayCell({
  date, monthStart, items, onOpenContent, onCreateAt, onExpand,
}: {
  date: Date
  monthStart: Date
  items: any[]
  onOpenContent: (id: string) => void
  onCreateAt: (date: Date) => void
  onExpand: (date: Date) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dateKey(date)}` })
  const inMonth = isSameMonth(date, monthStart)
  const today = isToday(date)
  const visible = items.slice(0, MAX_VISIBLE)
  const hidden = items.length - visible.length

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group min-h-[110px] p-1.5 border-r border-b border-border space-y-1',
        !inMonth && 'bg-muted/40',
        isOver && 'bg-primary/5'
      )}
    >
      <button
        type="button"
        onClick={() => (items.length > 0 ? onExpand(date) : onCreateAt(date))}
        className={cn(
          'w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold transition-colors',
          today ? 'bg-primary text-[#fff]' : inMonth ? 'text-foreground hover:bg-muted' : 'text-muted-foreground/50 hover:bg-muted'
        )}
      >
        {date.getDate()}
      </button>

      <div className="space-y-1">
        {visible.map((item) => (
          <ContentCard key={item.id} content={item} onClick={() => onOpenContent(item.id)} className="p-1 gap-1.5" />
        ))}
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => onExpand(date)}
          className="w-full text-[10px] font-bold text-primary hover:underline text-left"
        >
          +{hidden} mais
        </button>
      )}

      {items.length === 0 && (
        <button
          type="button"
          onClick={() => onCreateAt(date)}
          className="w-full flex items-center justify-center gap-1 text-[10px] font-medium text-transparent group-hover:text-muted-foreground py-1 transition-colors"
        >
          <Plus size={11} />
          <span>Criar</span>
        </button>
      )}
    </div>
  )
}

export function CalendarMonthView({ currentDate, contents, onOpenContent, onCreateAt }: CalendarMonthViewProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [expandedDay, setExpandedDay] = useState<Date | null>(null)
  const { monthStart, days } = getMonthGridRange(currentDate)

  const itemsByDay = (date: Date) =>
    contents
      .filter((c) => c.scheduledAt && isSameDay(new Date(c.scheduledAt), date))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

  if (!isDesktop) {
    const daysWithContent = days.filter((d) => isSameMonth(d, monthStart) && itemsByDay(d).length > 0)
    return (
      <div className="space-y-4">
        {daysWithContent.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-10">Nenhum conteúdo agendado neste mês.</p>
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
    <div className="border-t border-l border-border rounded-2xl overflow-hidden">
      <div className="grid grid-cols-7 bg-muted">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="px-2 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center border-r border-border">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => (
          <DayCell
            key={dateKey(date)}
            date={date}
            monthStart={monthStart}
            items={itemsByDay(date)}
            onOpenContent={onOpenContent}
            onCreateAt={onCreateAt}
            onExpand={setExpandedDay}
          />
        ))}
      </div>

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
