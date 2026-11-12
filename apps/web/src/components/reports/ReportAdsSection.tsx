import { ImageOff, MapPin, Megaphone, Target, TrendingDown, TrendingUp, Users } from 'lucide-react'

type Breakdown = { label: string; spend: number; impressions: number; clicks: number; results: number; contacts?: number }

function GrowthBadge({ pct, inverse = false }: { pct: number | null | undefined; inverse?: boolean }) {
  if (pct == null) return null
  // For cost metrics a drop is good news.
  const good = inverse ? pct <= 0 : pct >= 0
  return (
    <span className={`mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold ${good ? 'text-success-dark dark:text-success' : 'text-error-dark dark:text-error'}`}>
      {pct >= 0 ? <TrendingUp size={11} aria-hidden /> : <TrendingDown size={11} aria-hidden />}
      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

/**
 * Paid ads block of the public monthly report: account-currency KPIs, one card per campaign with
 * its creative and full metrics, then who/where the ads reached (regions with cost per result,
 * age & gender, placements). Old reports without the detailed snapshot degrade gracefully.
 */
export function ReportAdsSection({ ads, growth, currency }: { ads: any; growth?: any; currency: string }) {
  const money = (v: number | null | undefined) =>
    v == null || !Number.isFinite(v) ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v)
  const num = (v: number | null | undefined, digits = 0) =>
    v == null || !Number.isFinite(v) ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(v)
  const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(2)}%`)

  const kpis: { label: string; value: string; growth?: number | null; inverse?: boolean }[] = [
    { label: 'Investimento', value: money(ads.spend), growth: growth?.spendPct },
    { label: 'Resultados', value: num(ads.results), growth: growth?.resultsPct },
    { label: 'Custo por resultado', value: money(ads.costPerResult), growth: growth?.costPerResultPct, inverse: true },
    { label: 'Impressões', value: num(ads.impressions) },
    { label: 'Cliques', value: num(ads.clicks) },
    { label: 'CTR', value: pct(ads.ctr) },
    { label: 'CPC', value: money(ads.cpc) },
    ...(ads.audience?.reach ? [{ label: 'Alcance', value: num(ads.audience.reach) }] : []),
  ]

  return (
    <section className="space-y-6" aria-label="Anúncios pagos">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Megaphone size={14} className="text-primary" aria-hidden /> Anúncios pagos (Meta Ads)
        </h2>
        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Moeda: {currency}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-muted/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="mt-1 break-words text-lg font-bold tabular-nums text-foreground">{k.value}</p>
            <GrowthBadge pct={k.growth} inverse={k.inverse} />
          </div>
        ))}
      </div>

      {ads.audience && (ads.audience.contacts > 0 || ads.audience.frequency) && (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {ads.audience.frequency ? <>Cada pessoa viu os anúncios em média <strong className="text-foreground">{num(ads.audience.frequency, 2)}</strong> vezes. </> : null}
          {ads.audience.contacts > 0 ? <>Os anúncios geraram <strong className="text-foreground">{num(ads.audience.contacts)}</strong> contatos iniciados (conversas ou leads).</> : null}
        </p>
      )}

      {ads.campaigns?.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Resultados por campanha</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {ads.campaigns.map((c: any, i: number) => (
              <article key={c.campaignExternalId || i} className="print-avoid-break overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex gap-3 p-3">
                  <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {c.imageUrl
                      ? <img src={c.imageUrl} alt={`Criativo da campanha ${c.campaignName}`} width={80} height={80} loading="lazy" className="size-full object-cover" />
                      : <span className="flex size-full items-center justify-center text-muted-foreground"><ImageOff size={18} aria-hidden /></span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-[13px] font-semibold leading-snug text-foreground">{c.campaignName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{money(c.spend)} investidos</p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 border-t border-border text-center">
                  {[
                    ['Resultados', num(c.results)],
                    ['Custo/res.', money(c.costPerResult ?? (c.results ? c.spend / c.results : null))],
                    ['CTR', c.ctr != null ? pct(c.ctr) : '—'],
                    ['Impressões', c.impressions != null ? num(c.impressions) : '—'],
                    ['Cliques', c.clicks != null ? num(c.clicks) : '—'],
                    ['CPC', money(c.cpc)],
                  ].map(([label, value], idx) => (
                    <div key={label} className={`px-2 py-2.5 ${idx < 3 ? 'border-b border-border' : ''} ${idx % 3 !== 2 ? 'border-r border-border' : ''}`}>
                      <dt className="text-[11px] text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </div>
      )}

      {ads.audience && (
        <div className="grid gap-4 lg:grid-cols-1">
          <BreakdownTable title="Regiões" icon={MapPin} rows={ads.audience.regions} money={money} num={num} showCost />
          <BreakdownTable title="Público (idade · gênero)" icon={Users} rows={ads.audience.demographics} money={money} num={num} showCost />
          <BreakdownTable title="Posicionamentos" icon={Target} rows={ads.audience.placements} money={money} num={num} showCost />
        </div>
      )}
    </section>
  )
}

function BreakdownTable({ title, icon: Icon, rows, money, num, showCost }: {
  title: string
  icon: typeof MapPin
  rows: Breakdown[]
  money: (v: number | null | undefined) => string
  num: (v: number | null | undefined) => string
  showCost?: boolean
}) {
  if (!rows?.length) return null
  const max = Math.max(1, ...rows.map((r) => r.results))
  return (
    <div className="print-avoid-break rounded-xl border border-border p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Icon size={15} className="text-muted-foreground" aria-hidden />{title}</h3>
      {/* Phones: stacked rows (a table would push the page sideways) */}
      <ul className="divide-y divide-border/70 sm:hidden">
        {rows.map((r) => (
          <li key={r.label} className="py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{r.label}</span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">{num(r.results)} res.</span>
            </div>
            <span aria-hidden className="mt-1.5 block h-1 rounded-full bg-muted"><span className="block h-1 rounded-full bg-primary" style={{ width: `${(r.results / max) * 100}%` }} /></span>
            <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground">
              <span className="tabular-nums">Investimento {money(r.spend)}</span>
              {showCost && <span className="tabular-nums">Custo/res. <strong className="font-semibold text-foreground">{r.results ? money(r.spend / r.results) : '—'}</strong></span>}
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 font-semibold">{title === 'Regiões' ? 'Região' : title === 'Posicionamentos' ? 'Posicionamento' : 'Público'}</th>
              <th className="pb-2 text-right font-semibold">Resultados</th>
              <th className="pb-2 text-right font-semibold">Investimento</th>
              {showCost && <th className="pb-2 text-right font-semibold">Custo/res.</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border/70">
                <td className="py-2 pr-3">
                  <span className="block truncate font-medium text-foreground">{r.label}</span>
                  <span aria-hidden className="mt-1 block h-1 rounded-full bg-muted"><span className="block h-1 rounded-full bg-primary" style={{ width: `${(r.results / max) * 100}%` }} /></span>
                </td>
                <td className="py-2 text-right tabular-nums text-foreground">{num(r.results)}</td>
                <td className="py-2 text-right tabular-nums text-foreground">{money(r.spend)}</td>
                {showCost && <td className="py-2 text-right font-semibold tabular-nums text-foreground">{r.results ? money(r.spend / r.results) : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
