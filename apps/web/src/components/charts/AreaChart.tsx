import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface AreaSeries {
  key: string
  label: string
  color: string
  values: number[]
}

interface AreaChartProps {
  labels: string[]
  series: AreaSeries[]
  height?: number
  /** Formats the tooltip title for a point (defaults to the x label). */
  formatLabel?: (index: number) => string
  className?: string
}

const PAD = { top: 16, right: 12, bottom: 28, left: 44 }
// Axis ticks: 80000 -> "80 mil", 1200000 -> "1,2 mi" (pt-BR compact notation).
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

/** Monotone cubic path through the points (no overshoot below zero, smooth like the reference). */
function smoothPath(points: [number, number][]) {
  if (points.length < 2) return points.length ? `M${points[0][0]},${points[0][1]}` : ''
  const n = points.length
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1][0] - points[i][0]
    slope[i] = (points[i + 1][1] - points[i][1]) / dx[i]
  }
  const tangent: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i++) tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  tangent[n - 1] = slope[n - 2]
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const h = dx[i] / 3
    d += ` C${x0 + h},${y0 + tangent[i] * h} ${x1 - h},${y1 - tangent[i + 1] * h} ${x1},${y1}`
  }
  return d
}

/** Rounded axis maximum and 4 evenly spaced ticks. */
function niceScale(max: number) {
  if (max <= 0) return { top: 4, ticks: [0, 1, 2, 3, 4] }
  const rough = max / 4
  const mag = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) || mag * 10
  const stepInt = Math.max(1, Math.ceil(step))
  return { top: stepInt * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * stepInt) }
}

/**
 * Responsive SVG area chart: smooth lines with soft gradient fill, grid, x/y axes and a hover /
 * touch tooltip with a guide line. Renders at the container's real pixel width (no text stretching).
 */
export function AreaChart({ labels, series, height = 280, formatLabel, className }: AreaChartProps) {
  const id = useId().replace(/:/g, '')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const max = Math.max(0, ...series.flatMap((s) => s.values))
  const { top, ticks } = niceScale(max)
  const innerW = Math.max(0, width - PAD.left - PAD.right)
  const innerH = height - PAD.top - PAD.bottom
  const n = labels.length
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH

  const paths = useMemo(() => series.map((s) => {
    const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number])
    const line = smoothPath(pts)
    const area = pts.length ? `${line} L${x(n - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z` : ''
    return { ...s, line, area }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [series, width, top, n])

  // Show at most ~8 x labels so they never collide.
  // Space labels by their real width (11px uppercase ≈ 7px per char + gap), so long ones like
  // "13 DE OUT." never collide on a phone.
  const longest = labels.reduce((m, l) => Math.max(m, String(l).length), 0)
  const slot = Math.max(56, longest * 7 + 18)
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / slot))))

  const pick = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect || n === 0) return
    const rel = clientX - rect.left - PAD.left
    setHover(Math.max(0, Math.min(n - 1, Math.round((rel / Math.max(innerW, 1)) * (n - 1)))))
  }

  const tipLeft = hover !== null ? x(hover) : 0
  const tipOnRight = tipLeft < width * 0.6

  return (
    <div
      ref={wrapRef}
      className={cn('relative w-full select-none touch-pan-y', className)}
      style={{ height }}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerDown={(e) => pick(e.clientX)}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={series.map((s) => `${s.label}: ${s.values.reduce((a, b) => a + b, 0)} no período`).join('; ')}
    >
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {/* Y grid + labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{compact.format(t)}</text>
            </g>
          ))}

          {/* X labels */}
          {labels.map((l, i) => i % labelEvery === 0 && (
            <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 && n > 1 ? 'start' : 'middle'} className="fill-muted-foreground text-[11px] uppercase tracking-wide">{l}</text>
          ))}

          {paths.map((p) => <path key={`a-${p.key}`} d={p.area} fill={`url(#${id}-${p.key})`} />)}
          {paths.map((p) => (
            <path key={`l-${p.key}`} d={p.line} fill="none" stroke={p.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {n === 1 && series.map((s) => (
            <circle key={`single-${s.key}`} cx={x(0)} cy={y(s.values[0] ?? 0)} r={6} fill={s.color} className="stroke-card" strokeWidth={3} />
          ))}

          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="stroke-foreground/20" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={5} fill={s.color} className="stroke-card" strokeWidth={2.5} />
              ))}
            </g>
          )}
        </svg>
      )}

      {hover !== null && width > 0 && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[140px] rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-dropdown"
          style={tipOnRight ? { left: tipLeft + 14 } : { right: width - tipLeft + 14 }}
        >
          <p className="text-xs text-muted-foreground">{formatLabel ? formatLabel(hover) : labels[hover]}</p>
          <div className="mt-1.5 space-y-1">
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4 text-[13px]">
                <span className="flex items-center gap-1.5 text-foreground/80">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />{s.label}
                </span>
                <span className="font-semibold tabular-nums text-foreground">{s.values[hover] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
