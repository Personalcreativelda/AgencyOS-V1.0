import { useId, useState } from 'react'
import { Info, MapPin, Target, Users } from 'lucide-react'
import { Segmented } from '@/components/dashboard/DashboardWidgets'
import { DonutChart, DonutLegend, type DonutSlice } from '@/components/charts/DonutChart'

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
// Same palette family as the rest of the dashboards; the last slot is the neutral "Outros".
const PALETTE = ['#00A76F', '#00B8D9', '#8E33FF', '#FFAB00', '#FF5630']
const OTHERS = '#919EAB'
const MAX_SLICES = 5

// Meta returns placements like "whatsapp · status" — show proper product names.
const BRANDS: Record<string, string> = { whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger', audience_network: 'Audience Network', threads: 'Threads' }
const prettify = (label: string) => label
  .split(' · ')
  .map((part) => BRANDS[part.toLowerCase()] || part.replace(/_/g, ' ').replace(/^\p{Ll}/u, (c) => c.toUpperCase()))
  .join(' · ')

interface AudienceBreakdownProps {
  regions: AudienceSegment[]
  demographics: AudienceSegment[]
  placements: AudienceSegment[]
  formatMoney: (value: number) => string
}

/** Share of the selected metric per region / audience / placement, as rings (top 5 + "Outros"). */
export function AudienceBreakdown({ regions, demographics, placements, formatMoney }: AudienceBreakdownProps) {
  const [metric, setMetric] = useState<Metric>('contacts')
  const id = useId()
  const formatValue = (value: number) => Number.isFinite(value) ? metric === 'spend' ? formatMoney(value) : count.format(value) : '—'
  const groups = [
    { title: 'Regiões', noun: 'região', icon: MapPin, rows: regions },
    { title: 'Públicos', noun: 'idade e gênero', icon: Users, rows: demographics },
    { title: 'Posicionamentos', noun: 'posicionamento', icon: Target, rows: placements },
  ]

  return (
    <section className="min-w-0 space-y-4" aria-label="Comparação por região, público e posicionamento">
      <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground">Distribuição por público</h3>
          <p id={`${id}-scale`} className="mt-0.5 text-[13px] text-muted-foreground">Participação de cada item no total de {METRICS[metric].toLowerCase()}.</p>
        </div>
        <Segmented
          label="Comparar por"
          value={metric}
          onChange={setMetric}
          options={(Object.keys(METRICS) as Metric[]).map((key) => ({ value: key, label: METRICS[key] }))}
        />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:[&>*:last-child]:col-span-2 2xl:grid-cols-3 2xl:[&>*:last-child]:col-span-1">
        {groups.map((group, index) => {
          // Work on a copy so switching the metric never mutates API data.
          const value = (row: AudienceSegment) => Number.isFinite(row[metric]) ? Math.max(0, row[metric]) : 0
          const rows = [...group.rows].sort((a, b) => value(b) - value(a)).filter((row) => value(row) > 0)
          const top = rows.slice(0, MAX_SLICES)
          const rest = rows.slice(MAX_SLICES).reduce((sum, row) => sum + value(row), 0)
          const slices: DonutSlice[] = top.map((row, i) => ({ key: `${row.label}-${i}`, label: prettify(row.label), value: value(row), color: PALETTE[i] }))
          if (rest > 0) slices.push({ key: 'others', label: `Outros (${rows.length - MAX_SLICES})`, value: rest, color: OTHERS })
          const total = slices.reduce((sum, slice) => sum + slice.value, 0)
          const titleId = `${id}-group-${index}`
          return (
            <div key={group.title} className="flex min-w-0 flex-col rounded-[20px] border border-border/70 bg-card p-5 shadow-card sm:p-6">
              <h3 id={titleId} className="flex items-center gap-2 text-[15px] font-semibold text-foreground"><group.icon size={16} aria-hidden className="shrink-0 text-muted-foreground" />{group.title}</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">{METRICS[metric]} por {group.noun}</p>
              <div className="mt-4 border-t border-border/70 pt-5">
                {total > 0 ? (
                  <figure aria-labelledby={titleId} aria-describedby={`${id}-scale`} className="flex min-w-0 flex-col items-center gap-5 sm:flex-row md:flex-col 2xl:flex-row">
                    <DonutChart
                      slices={slices}
                      size={156}
                      thickness={18}
                      display={metric === 'spend' ? formatMoney(total) : count.format(total)}
                      caption={METRICS[metric]}
                    />
                    <DonutLegend slices={slices} format={formatValue} className="w-full min-w-0 flex-1" />
                  </figure>
                ) : (
                  <p className="py-8 text-center text-xs text-muted-foreground">{rows.length || group.rows.length ? 'Nenhum valor nesta métrica para o período.' : 'Sem dados disponíveis neste período.'}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
        <span>Contatos incluem conversas e leads reportados pela Meta. Os valores são agregados por entrega do anúncio e não representam pessoas únicas.</span>
      </p>
    </section>
  )
}
