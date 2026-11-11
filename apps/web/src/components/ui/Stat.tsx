import * as React from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

type Tone = 'default' | 'warning' | 'error' | 'success'

const TONE_TEXT: Record<Tone, string> = {
  default: 'text-foreground',
  warning: 'text-warning-dark dark:text-warning',
  error: 'text-error-dark dark:text-error',
  success: 'text-success-dark dark:text-success',
}
const TONE_DOT: Record<Tone, string> = {
  default: 'bg-muted-foreground',
  warning: 'bg-warning',
  error: 'bg-error',
  success: 'bg-success',
}

/**
 * A grid of metrics sharing one surface. Every cell draws its own right/bottom hairline and the
 * inner grid overhangs by 1px, so the outer edge clips the last row/column — dividers stay correct
 * at every breakpoint and an incomplete last row just shows card background.
 * `className` goes to the inner grid (e.g. "lg:grid-cols-3 xl:grid-cols-6").
 */
export function StatGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className={cn('-mb-px -mr-px grid grid-cols-2 lg:grid-cols-4 [&>*]:border-b [&>*]:border-r [&>*]:border-border max-sm:[&>*:last-child:nth-child(odd)]:col-span-2', className)}>
        {children}
      </div>
    </div>
  )
}

interface StatProps {
  label: string
  value: React.ReactNode
  icon?: React.ComponentType<{ size?: number | string; className?: string }>
  /** Secondary line under the value (context, comparison, source). */
  hint?: React.ReactNode
  /** Colours the value only when it is a positive number, so zeros stay calm. */
  tone?: Tone
  to?: string
  /** Native tooltip explaining how the metric is computed. */
  title?: string
  className?: string
}

export function Stat({ label, value, icon: Icon, hint, tone = 'default', to, title, className }: StatProps) {
  const numeric = typeof value === 'number' ? value : Number.NaN
  const active = tone !== 'default' && numeric > 0
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
          {active && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[tone])} />}
          <span className="min-h-10 leading-5">{label}</span>
        </span>
        {Icon && <Icon size={16} className="shrink-0 text-muted-foreground/70 transition-colors group-hover/stat:text-foreground" />}
      </div>
      <div className={cn('mt-2 break-words text-[22px] font-semibold leading-7 tabular-nums tracking-tight sm:text-2xl sm:leading-8', active ? TONE_TEXT[tone] : 'text-foreground')}>
        {value}
      </div>
      {hint && <div className="mt-1 hidden break-words text-xs text-muted-foreground sm:block">{hint}</div>}
    </>
  )
  const base = cn('group/stat min-w-0 bg-card p-4', className)
  return to ? (
    <Link to={to} title={title} className={cn(base, 'transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none')}>
      {body}
    </Link>
  ) : (
    <div title={title} className={base}>{body}</div>
  )
}

/** Borderless overview metric for dashboard summaries; separators belong to the parent grid. */
export function OverviewMetric({ label, value, icon: Icon, to }: Pick<StatProps, 'label' | 'value' | 'icon'> & { to: string }) {
  return (
    <Link to={to} className="group/metric flex min-w-0 flex-col gap-3 px-4 py-4 transition-colors duration-150 hover:bg-muted/40 focus-visible:bg-muted/40 sm:px-5">
      <div className="flex min-h-5 items-center gap-2 text-xs font-medium text-muted-foreground">
        {Icon && <Icon size={14} className="shrink-0 text-muted-foreground transition-colors duration-150 group-hover/metric:text-foreground" />}
        <span className="min-w-0 leading-5">{label}</span>
      </div>
      <span className="text-[32px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground sm:text-[36px]">{value}</span>
    </Link>
  )
}
