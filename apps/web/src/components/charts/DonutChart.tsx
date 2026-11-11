import { cn } from '@/lib/utils'

export interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  slices: DonutSlice[]
  /** Big number in the centre (defaults to the sum of slices). */
  total?: number
  caption?: string
  size?: number
  thickness?: number
  className?: string
}

/**
 * Ring chart with rounded segment caps and small gaps, total in the centre. Pure SVG.
 * Pair it with <DonutLegend>.
 */
export function DonutChart({ slices, total, caption, size = 200, thickness = 22, className }: DonutChartProps) {
  const sum = slices.reduce((a, s) => a + s.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const visible = slices.filter((s) => s.value > 0)
  // Gap between segments, in px along the circumference (skip when a single slice fills the ring).
  const gap = visible.length > 1 ? thickness * 0.9 : 0
  let offset = 0

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }} role="img"
      aria-label={visible.map((s) => `${s.label}: ${s.value}`).join(', ') || 'Sem dados'}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-muted" strokeWidth={thickness} />
        {sum > 0 && visible.map((s) => {
          const len = (s.value / sum) * c
          const dash = Math.max(len - gap, 0.001)
          const el = (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeLinecap={visible.length > 1 ? 'round' : 'butt'}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset - gap / 2}
              className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
            />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[34px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">{total ?? sum}</span>
        {caption && <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{caption}</span>}
      </div>
    </div>
  )
}

export function DonutLegend({ slices, className }: { slices: DonutSlice[]; className?: string }) {
  const sum = slices.reduce((a, s) => a + s.value, 0) || 1
  return (
    <ul className={cn('space-y-2.5', className)}>
      {slices.map((s) => (
        <li key={s.key} className="flex items-center gap-2.5 text-sm">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
          <span className="min-w-0 flex-1 truncate text-foreground/80">{s.label}</span>
          <span className="tabular-nums font-semibold text-foreground">{s.value}</span>
          <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">{Math.round((s.value / sum) * 100)}%</span>
        </li>
      ))}
    </ul>
  )
}
