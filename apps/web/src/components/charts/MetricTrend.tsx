import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AreaChart } from '@/components/charts/AreaChart'
import { Panel, PanelHeader, Segmented } from '@/components/dashboard/DashboardWidgets'

export type DailyRow = { date: string; [metric: string]: string | number }

export interface TrendMetric {
  key: string
  label: string
  /** One series per metric key (same colour family as the dashboard). */
  series: { key: string; label: string; color: string; pick: (row: DailyRow) => number }[]
  /** Formats the big total shown above the chart. */
  formatTotal?: (value: number) => string
}

const fmtNumber = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)

/**
 * Same visual language as the Dashboard production chart: panel, metric pills, big total and a
 * smooth area chart with hover tooltip. Feed it the daily rows the APIs already return.
 */
export function MetricTrend({ title, description, rows, metrics, empty = 'Sem dados diários neste período.' }: {
  title: string
  description?: string
  rows: DailyRow[]
  metrics: TrendMetric[]
  empty?: string
}) {
  const [active, setActive] = useState(metrics[0]?.key)
  const metric = metrics.find((m) => m.key === active) || metrics[0]
  const sorted = useMemo(() => [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date))), [rows])
  const labels = sorted.map((row) => format(new Date(`${String(row.date).slice(0, 10)}T12:00:00`), 'd MMM', { locale: ptBR }))
  const series = metric.series.map((s) => ({ key: s.key, label: s.label, color: s.color, values: sorted.map(s.pick) }))
  const total = series.reduce((sum, s) => sum + s.values.reduce((a, b) => a + b, 0), 0)

  return (
    <Panel>
      <PanelHeader
        title={title}
        description={description}
        action={metrics.length > 1 ? <Segmented label="Métrica" value={metric.key} options={metrics.map((m) => ({ value: m.key, label: m.label }))} onChange={setActive} /> : undefined}
      />
      {sorted.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">{(metric.formatTotal || fmtNumber)(total)}</span>
            <span className="text-sm text-muted-foreground">{metric.label.toLowerCase()} no período</span>
            {series.length > 1 && (
              <span className="ml-auto hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
                {series.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>)}
              </span>
            )}
          </div>
          <AreaChart
            labels={labels}
            series={series}
            height={260}
            formatLabel={(i) => format(new Date(`${String(sorted[i].date).slice(0, 10)}T12:00:00`), "EEEE, d 'de' MMM", { locale: ptBR })}
          />
        </>
      )}
    </Panel>
  )
}

/** Horizontal ranked bars (like the Meta audience breakdown) for any label/value list. */
export function RankedBars({ rows, color = '#007867', format: fmt = fmtNumber }: {
  rows: { label: string; value: number }[]
  color?: string
  format?: (v: number) => string
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-foreground/85">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">{fmt(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(3, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
