import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * One bordered surface holding many rows separated by hairlines — instead of a stack of
 * individually-shadowed cards. Reads as a single dataset and scans much faster.
 */
export function ListCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-minimals divide-y divide-border overflow-hidden', className)} {...props} />
}

/** Shared row styling for <ListCard> children (works on div, button, a or a router Link). */
export const listRowClass = (interactive = true) =>
  cn(
    'group flex w-full items-center gap-3 px-4 py-3.5 text-left sm:gap-4 sm:px-5',
    interactive && 'cursor-pointer transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none'
  )

/** Small, always-legible metadata line: items separated by middots, wraps cleanly on phones. */
export function Meta({ items, className }: { items: React.ReactNode[]; className?: string }) {
  const visible = items.filter((item) => item !== null && item !== undefined && item !== false && item !== '')
  return (
    // Every item carries its own leading "·" and the row is shifted left by that width inside a
    // clipped box, so a separator that lands at the start of a line (after wrapping) is hidden
    // instead of dangling at the end of the previous one.
    <div className={cn('min-w-0 overflow-hidden text-xs text-muted-foreground', className)}>
      <div className="-ml-3 flex min-w-0 flex-wrap items-center gap-y-0.5">
        {visible.map((item, i) => (
          <span key={i} className="inline-flex min-w-0 items-center gap-1 before:inline-block before:w-3 before:shrink-0 before:text-center before:text-muted-foreground/50 before:content-['·']">{item}</span>
        ))}
      </div>
    </div>
  )
}

/** Square thumbnail / logo slot with a neutral fallback. */
export function Thumb({
  src, fallback, className, rounded = 'rounded-xl',
}: { src?: string | null; fallback: React.ReactNode; className?: string; rounded?: string }) {
  return (
    <div
      className={cn(
        'flex size-11 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted text-muted-foreground',
        rounded,
        className
      )}
    >
      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : fallback}
    </div>
  )
}

/** Loading placeholder shaped like a <ListCard> of rows, so the page doesn't jump when data lands. */
export function ListSkeleton({ rows = 5, thumb = true }: { rows?: number; thumb?: boolean }) {
  return (
    <ListCard aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
          {thumb && <div className="size-11 shrink-0 animate-pulse rounded-xl bg-grey-200" />}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-grey-200" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-grey-200/70" />
          </div>
          <div className="hidden h-5 w-20 animate-pulse rounded-md bg-grey-200 sm:block" />
        </div>
      ))}
    </ListCard>
  )
}
