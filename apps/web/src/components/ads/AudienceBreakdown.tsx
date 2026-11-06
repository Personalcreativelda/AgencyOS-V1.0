import { useId, useState } from 'react'
import { MapPin, Target, Users } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'

export type AudienceSegment = {
  label: string
  spend: number
  impressions: number
  clicks: number
  results: number
  contacts: number
}

type Metric = 'contacts' | 'clicks' | 'results' | 'spend'
const METRICS: Record<Metric, string> = {
  contacts: 'Contatos', clicks: 'Cliques', results: 'Resultados', spend: 'Investimento',
}
const count = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

interface AudienceBreakdownProps {
  regions: AudienceSegment[]
  demographics: AudienceSegment[]
  placements: AudienceSegment[]
  formatMoney: (value: number) => string
}

/** Directly labelled horizontal bars: category comparisons, never a time series or a share of people. */
export function AudienceBreakdown({ regions, demographics, placements, formatMoney }: AudienceBreakdownProps) {
  const [metric, setMetric] = useState<Metric>('contacts')
  const id = useId()
  const formatValue = (value: number) => Number.isFinite(value) ? metric === 'spend' ? formatMoney(value) : count.format(value) : '—'
  const groups = [
    { title: 'Regiões', icon: MapPin, rows: regions },
    { title: 'Públicos', icon: Users, rows: demographics },
    { title: 'Posicionamentos', icon: Target, rows: placements },
  ]

  return (
    <section className="min-w-0 space-y-4" aria-label="Comparação por região, público e posicionamento">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <p id={`${id}-scale`} className="max-w-xl text-xs leading-relaxed text-muted-foreground">Maior para menor · escala relativa a cada grupo. Compare os valores; as barras não representam pessoas únicas.</p>
        <div className="w-full shrink-0 sm:w-44">
          <label htmlFor={`${id}-metric`} className="mb-1.5 block text-xs font-medium text-muted-foreground">Comparar por</label>
          <Select value={metric} onValueChange={value => setMetric(value as Metric)}>
            <SelectTrigger id={`${id}-metric`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(METRICS) as Metric[]).map(key => <SelectItem key={key} value={key}>{METRICS[key]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:[&>*:last-child]:col-span-2 2xl:grid-cols-3 2xl:[&>*:last-child]:col-span-1">
        {groups.map((group, index) => {
          // Work on a copy so switching the visual never mutates API data.
          const rows = [...group.rows].sort((a, b) => (Number.isFinite(b[metric]) ? b[metric] : 0) - (Number.isFinite(a[metric]) ? a[metric] : 0))
          const maximum = Math.max(0, ...rows.map(row => Number.isFinite(row[metric]) ? row[metric] : 0))
          const titleId = `${id}-group-${index}`
          return (
            <div key={group.title} className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 sm:p-5">
              <h3 id={titleId} className="flex items-center gap-2 text-[13px] font-semibold"><group.icon size={15} aria-hidden className="shrink-0 text-muted-foreground" />{group.title}</h3>
              {rows.length ? <>
                <figure aria-labelledby={titleId} aria-describedby={`${id}-scale`} className="mt-4 min-w-0 flex-1">
                  <figcaption className="mb-4 flex items-center justify-between gap-3 text-[11px] text-muted-foreground"><span>{METRICS[metric]}</span><span className="tabular-nums">0 — {formatValue(maximum)}</span></figcaption>
                  {maximum === 0 && <p className="mb-4 text-xs text-muted-foreground">Nenhum valor positivo nesta métrica para o período.</p>}
                  <ol className="space-y-4">
                    {rows.map((row, rowIndex) => {
                      const value = row[metric]
                      const width = maximum > 0 && Number.isFinite(value) ? Math.max(0, value) / maximum * 100 : 0
                      return (
                        <li key={`${row.label}-${rowIndex}`} title={`${row.label}: ${row.contacts} contatos · ${row.clicks} cliques · ${row.results} resultados · ${formatMoney(row.spend)}`}>
                          <div className="mb-2 flex items-start justify-between gap-3 text-xs leading-5">
                            <span className="min-w-0 break-words text-foreground">{row.label}</span>
                            <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatValue(value)}</span>
                          </div>
                          <div aria-hidden className="h-2 overflow-hidden rounded-sm bg-muted"><div className="h-full rounded-sm bg-primary-dark dark:bg-primary" style={{ width: `${width}%` }} /></div>
                        </li>
                      )
                    })}
                  </ol>
                </figure>
              </> : <p className="py-8 text-xs text-muted-foreground">Sem dados disponíveis neste período.</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
