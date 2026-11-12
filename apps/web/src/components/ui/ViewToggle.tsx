import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'

type View = 'grid' | 'list'

/**
 * The one grid/list switch used across the app (Conteúdos, Clientes…): two icon buttons, same
 * size as the toolbar controls, labels for screen readers and tooltips.
 */
export function ViewToggle({ value, onChange, className }: { value: View; onChange: (view: View) => void; className?: string }) {
  const options = [
    { value: 'list' as const, label: 'Lista', icon: List },
    { value: 'grid' as const, label: 'Grade', icon: LayoutGrid },
  ]
  return (
    <div role="radiogroup" aria-label="Visualização" className={cn('inline-flex h-10 shrink-0 items-center gap-0.5 rounded-xl border border-border bg-card p-1', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            value === option.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <option.icon size={17} />
        </button>
      ))}
    </div>
  )
}
