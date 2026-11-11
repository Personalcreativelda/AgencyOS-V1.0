import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterPill<K extends string> {
  key: K
  label: string
  count?: number
}

/**
 * Stitch-style status filter: rounded pills with counts, plus an optional search field.
 * One component for every list page (campanhas, aprovações, relatórios, canais…).
 */
export function FilterBar<K extends string>({
  pills,
  value,
  onChange,
  query,
  onQuery,
  placeholder = 'Pesquisar',
  label = 'Filtrar',
  className,
}: {
  pills: FilterPill<K>[]
  value: K
  onChange: (key: K) => void
  query?: string
  onQuery?: (q: string) => void
  placeholder?: string
  label?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" role="tablist" aria-label={label}>
        {pills.map((p) => {
          const active = value === p.key
          return (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(p.key)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                active ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {p.label}
              {p.count !== undefined && (
                <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-background/20' : 'bg-muted')}>{p.count}</span>
              )}
            </button>
          )
        })}
      </div>
      {onQuery && (
        <label className="relative block w-full sm:w-64">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query ?? ''}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-9 w-full rounded-full border border-border bg-card pl-9 pr-4 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
        </label>
      )}
    </div>
  )
}
