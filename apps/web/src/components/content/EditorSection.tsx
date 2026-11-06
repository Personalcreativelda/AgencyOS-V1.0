import { type ReactNode, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EditorSection({ title, summary, open, onToggle, children }: {
  title: string; summary?: ReactNode; open: boolean; onToggle: () => void; children: ReactNode
}) {
  const id = useId()
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <h2><button type="button" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}
        className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 motion-reduce:transition-none sm:px-5">
        <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span>{summary && <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{summary}</span>}</span>
        <ChevronDown size={16} aria-hidden className={cn('shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')} />
      </button></h2>
      <div id={`${id}-body`} hidden={!open} className="space-y-4 border-t border-border px-4 py-5 sm:px-5">{children}</div>
    </section>
  )
}
