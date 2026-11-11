import type { ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ListFilter, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterMenuProps {
  /** Number of active filters (shown as a badge on the trigger). */
  active: number
  onClear?: () => void
  children: ReactNode
  className?: string
}

/**
 * One "Filtros" button that opens a panel with the page's filter controls — instead of a row of
 * always-visible selects. Pattern from Linear / Stripe: calm toolbar, details on demand.
 */
export function FilterMenu({ active, onClear, children, className }: FilterMenuProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            active ? 'border-primary/40 bg-primary/10 text-primary-dark dark:text-primary-light' : 'border-border bg-card text-foreground hover:bg-muted',
            className
          )}
        >
          <ListFilter size={16} aria-hidden />
          Filtros
          {active > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-[#fff]">{active}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(320px,calc(100vw-24px))] rounded-2xl border border-border bg-card p-4 shadow-dropdown data-[state=open]:animate-fade-in data-[state=closed]:animate-overlay-out"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Filtros</p>
            <div className="flex items-center gap-1">
              {active > 0 && onClear && (
                <button type="button" onClick={onClear} className="rounded-md px-2 py-1 text-[13px] font-semibold text-primary-dark hover:bg-primary/10 dark:text-primary-light">Limpar</button>
              )}
              <Popover.Close aria-label="Fechar filtros" className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={15} />
              </Popover.Close>
            </div>
          </div>
          <div className="space-y-3">{children}</div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Label + control row used inside <FilterMenu>. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
