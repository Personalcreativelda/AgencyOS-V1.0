import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Surface used by every dashboard block: generous radius, hairline border, soft shadow. */
export function Panel({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('flex h-full min-w-0 flex-col rounded-[20px] border border-border/70 bg-card p-5 shadow-card sm:p-6', className)} {...props}>
      {children}
    </section>
  )
}

/** Panel title row with a hairline under it, like the reference ("Monthly pageviews ··· This month"). */
export function PanelHeader({ title, description, action, divider = true }: {
  title: ReactNode; description?: ReactNode; action?: ReactNode; divider?: boolean
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', divider && 'mb-5 border-b border-border/70 pb-4')}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** ↗ 12.5% / ↘ 3.1% chip. `null` means "no previous data to compare with". */
export function Trend({ value, suffix = 'vs período anterior' }: { value: number | null | undefined; suffix?: string }) {
  if (value === undefined) return null
  if (value === null) return <span className="text-[13px] text-muted-foreground">Primeiro período com dados</span>
  const up = value > 0
  const flat = value === 0
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums',
        flat ? 'text-muted-foreground' : up ? 'text-success-dark dark:text-success' : 'text-error-dark dark:text-error')}>
        {Math.abs(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%<Icon size={13} strokeWidth={2.5} aria-hidden />
      </span>
      <span className="hidden text-muted-foreground sm:inline">{suffix}</span>
    </span>
  )
}

type Tone = 'brand' | 'info' | 'warning' | 'error' | 'secondary'
const TONES: Record<Tone, string> = {
  brand: 'bg-primary/10 text-primary-dark dark:text-primary-light',
  info: 'bg-info/10 text-info-dark dark:text-info-light',
  warning: 'bg-warning/10 text-warning-dark dark:text-warning-light',
  error: 'bg-error/10 text-error-dark dark:text-error-light',
  secondary: 'bg-secondary/10 text-secondary-dark dark:text-secondary-light',
}
const TONE_TEXT: Record<Tone, string> = {
  brand: 'text-primary-dark dark:text-primary-light',
  info: 'text-info-dark dark:text-info-light',
  warning: 'text-warning-dark dark:text-warning-light',
  error: 'text-error-dark dark:text-error-light',
  secondary: 'text-secondary-dark dark:text-secondary-light',
}

/** KPI card: tinted icon tile, label, big value and a trend / context line. */
/** Tiny trend line for KPI cards (normalised to its own min/max). */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2 || values.every((v) => v === values[0])) return null
  const w = 72
  const h = 22
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg aria-hidden viewBox={`0 0 ${w} ${h}`} className={cn('h-[22px] w-[72px] shrink-0 overflow-visible', className)} fill="none">
      <path d={d} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Small chip for the KPI card's top-right corner: ↗ 25% / ↘ 3% / urgency label. */
export function KpiBadge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'up' | 'down' | 'warning' | 'error' | 'neutral'; className?: string }) {
  const tones = {
    up: 'bg-success/10 text-success-dark dark:text-success',
    down: 'bg-error/10 text-error-dark dark:text-error',
    warning: 'bg-warning/15 text-warning-dark dark:text-warning',
    error: 'bg-error/10 text-error-dark dark:text-error',
    neutral: 'bg-muted text-muted-foreground',
  }
  return <span className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums', tones[tone], className)}>{children}</span>
}

/** Trend → KpiBadge (null/undefined → no badge). */
export function TrendBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus
  return (
    <KpiBadge tone={value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'}>
      <Icon size={13} strokeWidth={2.5} aria-hidden />{Math.abs(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </KpiBadge>
  )
}

/**
 * KPI card (Stitch dashboard): tinted icon tile + badge on top, then label, big value and a context
 * line with an optional sparkline.
 */
export function KpiCard({ label, value, icon: Icon, tone = 'brand', footer, to, alert, badge, sparkline }: {
  label: string
  value: ReactNode
  icon: ComponentType<{ size?: number | string; className?: string; strokeWidth?: number | string }>
  tone?: Tone
  footer?: ReactNode
  to?: string
  /** Paint the value in the tone colour (for counts that need action). */
  alert?: boolean
  /** Top-right chip (trend or urgency). */
  badge?: ReactNode
  /** Values for the mini trend line next to the footer. */
  sparkline?: number[]
}) {
  const body = (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-12', TONES[tone])}>
          <Icon size={22} strokeWidth={2} />
        </span>
        {badge}
      </div>
      <p className="mt-4 line-clamp-2 text-[13px] font-medium leading-snug text-muted-foreground sm:text-sm">{label}</p>
      <p className={cn('mt-1 text-[28px] font-bold leading-9 tracking-[-0.03em] tabular-nums sm:text-[32px]',
        alert ? TONE_TEXT[tone] : 'text-foreground')}>
        {value}
      </p>
      {/* No caption text under the number (it repeated what the card already says) — only the trend line. */}
      {sparkline && (
        <div className="mt-auto flex min-h-6 items-end justify-end pt-2">
          <Sparkline values={sparkline} className={cn('hidden sm:block', TONE_TEXT[tone])} />
        </div>
      )}
    </div>
  )
  const cls = 'block h-full min-w-0 rounded-[20px] border border-border/70 bg-card p-4 shadow-card transition-[border-color,box-shadow] duration-200 sm:p-5'
  return to ? (
    <Link to={to} className={cn(cls, 'hover:border-grey-400 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40')}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** Pill segmented control (period picker). */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-card p-1 shadow-card [scrollbar-width:none] sm:inline-flex sm:w-auto [&::-webkit-scrollbar]:hidden">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('h-8 flex-1 shrink-0 whitespace-nowrap rounded-full px-3 text-[13px] sm:px-3.5 font-semibold transition-colors sm:flex-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            value === o.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Horizontal share bar used in the network breakdown. */
export function ShareBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  )
}
