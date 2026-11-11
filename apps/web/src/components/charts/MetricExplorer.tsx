import { useState, type ComponentType, type ReactNode } from 'react'
import { AreaChart } from '@/components/charts/AreaChart'
import { cn } from '@/lib/utils'

export type ExplorerRow = Record<string, string | number>

export interface ExplorerTile {
  key: string
  label: string
  value: ReactNode
  icon?: ComponentType<{ size?: number | string; className?: string }>
  hint?: string
  /** When set, the tile is selectable and drives the chart below. */
  chart?: { color: string; pick: (row: ExplorerRow) => number }
}

/**
 * Stripe/Stitch-style metrics: KPI tiles on top, the selected one drives the area chart below.
 * Replaces "KPI strip + separate chart with its own metric pills" (same numbers twice).
 */
export function MetricExplorer({ tiles, rows, labelOf, tooltipOf, caption, empty = 'Sem dados neste período.' }: {
  tiles: ExplorerTile[]
  rows: ExplorerRow[]
  /** X-axis label for a row (day or hour). */
  labelOf: (row: ExplorerRow) => string
  tooltipOf?: (row: ExplorerRow) => string
  /** Small line above the chart, e.g. "Por hora · hoje". */
  caption?: string
  empty?: string
}) {
  const chartable = tiles.filter((t) => t.chart)
  const [selected, setSelected] = useState(chartable[0]?.key)
  const active = chartable.find((t) => t.key === selected) || chartable[0]

  return (
    <section className="overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-card">
      {/* KPI tiles */}
      <div className="overflow-hidden border-b border-border/70">
      <div className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
        {tiles.map((tile) => {
          const isActive = active?.key === tile.key
          const body = (
            <>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-muted-foreground">{tile.label}</span>
                {tile.icon && <tile.icon size={15} className="shrink-0 text-muted-foreground/70" />}
              </span>
              <span className="mt-2 block break-words text-[20px] font-bold leading-7 tracking-[-0.02em] tabular-nums text-foreground sm:text-[22px]">{tile.value}</span>
            </>
          )
          const base = 'relative min-w-0 border-b border-r border-border/70 p-4 text-left sm:p-5'
          return tile.chart ? (
            <button
              key={tile.key}
              type="button"
              title={tile.hint}
              aria-pressed={isActive}
              onClick={() => setSelected(tile.key)}
              className={cn(base, 'transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none', isActive && 'bg-muted/50')}
            >
              {isActive && <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: tile.chart.color }} />}
              {body}
            </button>
          ) : (
            <div key={tile.key} title={tile.hint} className={base}>{body}</div>
          )
        })}
      </div>
      </div>

      {/* Chart for the selected tile */}
      <div className="p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{active?.label}</p>
          {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
        </div>
        {active && rows.length > 0 ? (
          <AreaChart
            height={240}
            labels={rows.map(labelOf)}
            formatLabel={(i) => (tooltipOf ? tooltipOf(rows[i]) : labelOf(rows[i]))}
            series={[{ key: active.key, label: active.label, color: active.chart!.color, values: rows.map(active.chart!.pick) }]}
          />
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">{empty}</div>
        )}
      </div>
    </section>
  )
}
