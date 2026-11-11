import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, addWeeks, format, isBefore, isSameDay, isSameMonth, isToday, startOfDay, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContentCard } from './ContentCard'
import { capitalize } from './plannerUtils'

interface PlannerWeekViewProps {
  /** Month currently loaded by the page (contents cover its full week grid). */
  currentDate: Date
  contents: any[]
  onOpenContent: (id: string) => void
  onCreateAt: (date: Date) => void
  /** Called when the visible week moves into another month, so the page can load it. */
  onNavigateMonth?: (date: Date) => void
}

const WEEK_OPTS = { weekStartsOn: 1 as const }

/**
 * Phone planner in the Meta Business Suite pattern: month label, a 7-day week strip with the
 * selected day in a filled circle, then a day-by-day agenda for that week — each day lists its
 * posts or offers "Toque para criar"; today is marked with a line. Swipe or arrows change week.
 */
export function PlannerWeekView({ currentDate, contents, onOpenContent, onCreateAt, onNavigateMonth }: PlannerWeekViewProps) {
  const initial = isSameMonth(new Date(), currentDate) ? new Date() : currentDate
  const [selected, setSelected] = useState<Date>(startOfDay(initial))
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const touchX = useRef<number | null>(null)

  // Keep the selection inside the month the page loaded (e.g. after "Hoje" or month arrows).
  useEffect(() => {
    if (!isSameMonth(selected, currentDate)) {
      setSelected(startOfDay(isSameMonth(new Date(), currentDate) ? new Date() : currentDate))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate])

  const weekStart = startOfWeek(selected, WEEK_OPTS)
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart.getTime()])

  const itemsByDay = (date: Date) =>
    contents
      .filter((c) => c.scheduledAt && isSameDay(new Date(c.scheduledAt), date))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

  const moveWeek = (delta: number) => {
    const next = addWeeks(selected, delta)
    setSelected(next)
    if (!isSameMonth(next, currentDate)) onNavigateMonth?.(next)
  }

  const pickDay = (day: Date) => {
    setSelected(day)
    rowRefs.current[day.toDateString()]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const today = startOfDay(new Date())

  return (
    <div className="-mx-4 sm:-mx-6">
      {/* Month + week navigation */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 pb-1 pt-1 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {capitalize(format(selected, 'MMMM', { locale: ptBR }))}
            <span className="ml-1.5 font-normal text-muted-foreground">{format(selected, 'yyyy')}</span>
          </h2>
          <div className="flex items-center">
            <button type="button" onClick={() => moveWeek(-1)} aria-label="Semana anterior" className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronLeft size={20} />
            </button>
            <button type="button" onClick={() => moveWeek(1)} aria-label="Próxima semana" className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Dias da semana"
          className="grid grid-cols-7 px-2 pb-3 sm:px-4"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            touchX.current = null
            if (Math.abs(dx) > 50) moveWeek(dx < 0 ? 1 : -1)
          }}
        >
          {week.map((day) => {
            const active = isSameDay(day, selected)
            const isTodayDay = isToday(day)
            const has = itemsByDay(day).length > 0
            return (
              <button
                key={day.toDateString()}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
                onClick={() => pickDay(day)}
                className="flex flex-col items-center gap-1.5"
              >
                <span className={cn('text-[13px]', active || isTodayDay ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                  {capitalize(format(day, 'EEEEEE', { locale: ptBR }))}
                </span>
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full text-[15px] tabular-nums transition-colors',
                    active ? 'bg-primary font-semibold text-[#fff] shadow-[0_6px_14px_-6px_rgba(0,120,103,0.7)]'
                      : isTodayDay ? 'font-semibold text-primary-dark dark:text-primary-light'
                      : 'text-foreground/70'
                  )}
                >
                  {day.getDate()}
                </span>
                <span aria-hidden className={cn('size-1 rounded-full', has ? (active ? 'bg-primary' : 'bg-muted-foreground/60') : 'bg-transparent')} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Day-by-day agenda for the week */}
      <div className="divide-y divide-border/60">
        {week.map((day) => {
          const items = itemsByDay(day)
          const isTodayDay = isToday(day)
          const past = isBefore(day, today)
          return (
            <div
              key={day.toDateString()}
              ref={(el) => { rowRefs.current[day.toDateString()] = el }}
              className="relative flex scroll-mt-40 gap-4 px-4 py-4 sm:px-6"
            >
              {isTodayDay && (
                <div aria-hidden className="absolute inset-x-4 top-0 flex items-center sm:inset-x-6">
                  <span className="size-2.5 rounded-full bg-primary" />
                  <span className="h-0.5 flex-1 bg-primary" />
                </div>
              )}

              <div className="w-12 shrink-0 text-center">
                <p className={cn('text-[26px] font-medium leading-none tabular-nums', isTodayDay ? 'text-primary-dark dark:text-primary-light' : 'text-foreground')}>
                  {day.getDate()}
                </p>
                <p className={cn('mt-1 text-sm', isTodayDay ? 'font-semibold text-primary-dark dark:text-primary-light' : 'text-muted-foreground')}>
                  {capitalize(format(day, 'EEE', { locale: ptBR }).replace('.', ''))}
                </p>
              </div>

              <div className="min-w-0 flex-1 space-y-2 pt-1">
                {items.map((item) => (
                  <ContentCard key={item.id} content={item} onClick={() => onOpenContent(item.id)} />
                ))}
                {items.length === 0 && past && (
                  <p className="pt-1 text-sm text-muted-foreground">Nenhuma publicação neste dia</p>
                )}
                {!past && (
                  <button
                    type="button"
                    onClick={() => onCreateAt(day)}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-2.5 rounded-lg pr-2 text-sm font-semibold transition-colors',
                      isTodayDay ? 'text-primary-dark dark:text-primary-light' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className={cn('flex size-6 items-center justify-center rounded-full', isTodayDay ? 'bg-primary text-[#fff]' : 'border-[1.5px] border-current')}>
                      <Plus size={14} strokeWidth={2.5} />
                    </span>
                    {items.length ? 'Adicionar outro' : 'Toque para criar'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
