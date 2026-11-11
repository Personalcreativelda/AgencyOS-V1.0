import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/middleware/errorHandler';
import { resolveAgencyAIProvider } from '../../integrations/ai/ai.provider';
import { decrypt } from '../../common/crypto';
import { getStorageProvider } from '../../common/storage';
import { fetchCampaignContext, fetchCampaignPreviewImage } from '../ads/ads.controller';

type BreakdownRow = { label: string; spend: number; impressions: number; clicks: number; results: number; contacts: number };

interface AdsCampaignStats {
  campaignExternalId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  cpc: number | null;
  costPerResult: number | null;
  imageUrl?: string | null;
}

interface AdsPeriodStats {
  /** ISO code of the ad account currency (e.g. ZAR, MZN, BRL). */
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  cpc: number;
  costPerResult: number | null;
  campaigns: AdsCampaignStats[];
  /** Only on the current period: who and where the ads reached (Meta breakdowns). */
  audience?: {
    reach: number | null;
    frequency: number | null;
    contacts: number;
    linkClicks: number;
    regions: BreakdownRow[];
    demographics: BreakdownRow[];
    placements: BreakdownRow[];
  } | null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Copies a Meta creative image into our storage: Meta CDN links expire, a report is permanent. */
async function persistCreativeImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 6 * 1024 * 1024) return null;
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const { publicUrl } = await getStorageProvider().upload(buffer, `report-creative.${ext}`, type);
    return publicUrl;
  } catch {
    return null;
  }
}

function mergeBreakdowns(lists: BreakdownRow[][], limit: number): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>();
  for (const row of lists.flat()) {
    const agg = map.get(row.label) || { label: row.label, spend: 0, impressions: 0, clicks: 0, results: 0, contacts: 0 };
    agg.spend += row.spend; agg.impressions += row.impressions; agg.clicks += row.clicks; agg.results += row.results; agg.contacts += row.contacts;
    map.set(row.label, agg);
  }
  return [...map.values()].sort((a, b) => b.results - a.results || b.spend - a.spend).slice(0, limit);
}

// Pulls Meta Ads performance for a client's connected ad account(s) — same aggregation shape as
// the Ads page itself — for an arbitrary date range, so the report can show both the current
// period and, for growth comparison, the immediately preceding period of equal length. Returns
// null when the client has no connected ad account (reports for organic-only clients skip the
// ads section entirely rather than showing a wall of zeros). `detailed` adds the audience
// breakdowns and campaign creatives (current period only — the comparison only needs totals).
async function aggregateAdsForPeriod(agencyId: string, clientId: string, start: Date, end: Date, detailed = false): Promise<AdsPeriodStats | null> {
  const connections = await prisma.socialConnection.findMany({
    where: { agencyId, clientId, platform: 'META_ADS' },
    select: { id: true, metadata: true, accessTokenEncrypted: true, externalPageId: true, status: true },
  });
  if (!connections.length) return null;

  let currency = 'BRL';
  for (const c of connections) {
    try { const m = c.metadata ? JSON.parse(c.metadata) : null; if (m?.currency) { currency = m.currency; break; } } catch { /* old connection */ }
  }

  const rows = await prisma.adInsightDaily.findMany({
    where: { connectionId: { in: connections.map((c) => c.id) }, date: { gte: start, lte: end } },
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.spend += r.spend; acc.impressions += r.impressions; acc.clicks += r.clicks; acc.results += r.results || 0;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, results: 0 }
  );

  const byCampaign = new Map<string, AdsCampaignStats>();
  for (const r of rows) {
    const agg = byCampaign.get(r.campaignExternalId) || {
      campaignExternalId: r.campaignExternalId, campaignName: r.campaignName,
      spend: 0, impressions: 0, clicks: 0, results: 0, ctr: 0, cpc: null, costPerResult: null,
    };
    agg.spend += r.spend; agg.impressions += r.impressions; agg.clicks += r.clicks; agg.results += r.results || 0;
    byCampaign.set(r.campaignExternalId, agg);
  }
  const campaigns = [...byCampaign.values()]
    .map((c) => ({
      ...c,
      ctr: c.impressions ? (c.clicks / c.impressions) * 100 : 0,
      cpc: c.clicks ? c.spend / c.clicks : null,
      costPerResult: c.results ? c.spend / c.results : null,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  let audience: AdsPeriodStats['audience'] = null;
  if (detailed) {
    const live = connections.filter((c) => c.status === 'ACTIVE' && c.accessTokenEncrypted && c.externalPageId);
    const range = { since: ymd(start), until: ymd(end) };
    const contexts = (await Promise.all(live.map((c) => fetchCampaignContext(c, 30, undefined, range).catch(() => null)))).filter(Boolean) as any[];
    if (contexts.length) {
      audience = {
        reach: contexts.reduce((s, c) => s + (c.reach || 0), 0) || null,
        frequency: contexts.length === 1 ? contexts[0].frequency : (contexts.find((c) => c.frequency)?.frequency ?? null),
        contacts: contexts.reduce((s, c) => s + (c.contacts || 0), 0),
        linkClicks: contexts.reduce((s, c) => s + (c.linkClicks || 0), 0),
        regions: mergeBreakdowns(contexts.map((c) => c.regions || []), 8),
        demographics: mergeBreakdowns(contexts.map((c) => c.demographics || []), 8),
        placements: mergeBreakdowns(contexts.map((c) => c.placements || []), 8),
      };
    }
    // Creative previews for the top campaigns, copied into our storage.
    const tokenByConnection = new Map(live.map((c) => [c.id, decrypt(c.accessTokenEncrypted!)]));
    const connectionByCampaign = new Map(rows.map((r) => [r.campaignExternalId, r.connectionId]));
    await Promise.all(campaigns.slice(0, 8).map(async (c) => {
      const token = tokenByConnection.get(connectionByCampaign.get(c.campaignExternalId) || '');
      if (!token) return;
      const metaUrl = await fetchCampaignPreviewImage(token, c.campaignExternalId);
      c.imageUrl = metaUrl ? await persistCreativeImage(metaUrl) : null;
    }));
  }

  return {
    currency,
    ...totals,
    ctr: totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks ? totals.spend / totals.clicks : 0,
    costPerResult: totals.results ? totals.spend / totals.results : null,
    campaigns,
    audience,
  };
}

// null when there's no meaningful baseline to compare against (avoids a misleading "+∞%" off a
// zero previous period, or one with zero spend/results).
function pctGrowth(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.query;
    const where: any = { agencyId: req.user!.agencyId };
    if (clientId) where.clientId = clientId;

    const reports = await prisma.report.findMany({
      where,
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(reports);
  } catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, title, periodStart, periodEnd } = req.body;
    if (!clientId || !title || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'clientId, title, periodStart, periodEnd required' });
    }

    const agencyId = req.user!.agencyId;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // Immediately preceding period of equal length — the baseline "growth" (crescimento) is
    // measured against, for both ads and organic output.
    const periodMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(start.getTime() - periodMs - 1);

    const [client, published, approvals, strategy, ads, prevAds] = await Promise.all([
      prisma.client.findFirst({ where: { id: clientId, agencyId } }),
      prisma.content.findMany({
        where: { agencyId, clientId, status: 'PUBLISHED', publishedAt: { gte: start, lte: end } },
        select: { id: true, title: true, contentType: true, publishedAt: true },
      }),
      prisma.approvalRequest.findMany({
        where: { agencyId, clientId, createdAt: { gte: start, lte: end } },
        select: { status: true },
      }),
      // Most recent defined goal/objective for this client — gives the AI something concrete
      // to measure progress against instead of just narrating raw numbers.
      prisma.strategy.findFirst({ where: { agencyId, clientId }, orderBy: { createdAt: 'desc' }, select: { objective: true } }),
      aggregateAdsForPeriod(agencyId, clientId, start, end, true),
      aggregateAdsForPeriod(agencyId, clientId, prevStart, prevEnd),
    ]);
    if (!client) throw new NotFoundError('Client not found');

    const approvedCount = approvals.filter((a) => a.status === 'APPROVED').length;
    const changesRequestedCount = approvals.filter((a) => a.status === 'CHANGES_REQUESTED').length;

    const stats = {
      contentsPublished: published.length,
      contentsByType: published.reduce((acc: Record<string, number>, c) => {
        acc[c.contentType] = (acc[c.contentType] || 0) + 1;
        return acc;
      }, {}),
      approvalsSent: approvals.length,
      approvedCount,
      changesRequestedCount,
    };

    const adsGrowth = ads && prevAds ? {
      spendPct: pctGrowth(ads.spend, prevAds.spend),
      resultsPct: pctGrowth(ads.results, prevAds.results),
      costPerResultPct: ads.costPerResult != null && prevAds.costPerResult != null ? pctGrowth(ads.costPerResult, prevAds.costPerResult) : null,
    } : null;

    const adsBlock = ads
      ? `=== ANÚNCIOS PAGOS (Meta Ads) — período atual ===
Moeda da conta de anúncios: ${ads.currency} (use SEMPRE este código, nunca "R$" se a moeda não for BRL)
Investimento: ${ads.currency} ${ads.spend.toFixed(2)} | Impressões: ${ads.impressions} | Cliques: ${ads.clicks} | Resultados: ${ads.results} | CTR: ${ads.ctr.toFixed(2)}% | Custo/Resultado: ${ads.costPerResult != null ? `${ads.currency} ${ads.costPerResult.toFixed(2)}` : 'N/A'}
Campanhas: ${ads.campaigns.map((c) => `"${c.campaignName}" (gasto ${ads.currency} ${c.spend.toFixed(2)}, ${c.results} resultados, CTR ${c.ctr.toFixed(2)}%, custo/resultado ${c.costPerResult != null ? `${ads.currency} ${c.costPerResult.toFixed(2)}` : 'N/A'})`).join('; ') || 'nenhuma'}
${ads.audience ? `Regiões (resultados / gasto): ${ads.audience.regions.map((r) => `${r.label} ${r.results}/${ads.currency} ${r.spend.toFixed(2)}`).join('; ') || 'sem dados'}
Público (idade · género): ${ads.audience.demographics.map((r) => `${r.label} ${r.results}`).join('; ') || 'sem dados'}
Posicionamentos: ${ads.audience.placements.map((r) => `${r.label} ${r.results}`).join('; ') || 'sem dados'}
Alcance: ${ads.audience.reach ?? 'N/A'} | Frequência: ${ads.audience.frequency != null ? ads.audience.frequency.toFixed(2) : 'N/A'} | Contatos iniciados: ${ads.audience.contacts}` : ''}
${prevAds ? `Comparado ao período anterior (${prevStart.toLocaleDateString('pt-BR')} a ${prevEnd.toLocaleDateString('pt-BR')}): investimento ${prevAds.spend.toFixed(2)}→${ads.spend.toFixed(2)} (${adsGrowth?.spendPct != null ? `${adsGrowth.spendPct >= 0 ? '+' : ''}${adsGrowth.spendPct.toFixed(1)}%` : 'sem base de comparação'}), resultados ${prevAds.results}→${ads.results} (${adsGrowth?.resultsPct != null ? `${adsGrowth.resultsPct >= 0 ? '+' : ''}${adsGrowth.resultsPct.toFixed(1)}%` : 'sem base de comparação'})` : 'Sem dados do período anterior para comparar.'}`
      : '=== ANÚNCIOS PAGOS (Meta Ads) ===\nNenhuma conta de anúncios conectada para este cliente — sem dados de tráfego pago neste relatório.';

    const ai = await resolveAgencyAIProvider(agencyId, 'text');
    const analysis = await ai.generateJSON<{ summary: string; aiAnalysis: string; recommendations: { title: string; description: string; priority: number }[] }>({
      systemPrompt: `Você é um estrategista sênior de marketing digital (conteúdo orgânico + tráfego pago) escrevendo um relatório mensal de performance para o CLIENTE de uma agência — quem vai ler isso é quem contrata o serviço, não a agência, e precisa sair da leitura entendendo claramente como o trabalho está indo, se está crescendo, e o que esperar a seguir.
Retorne SOMENTE JSON, sem markdown: { "summary": string (2-3 frases, tom executivo, direto sobre a situação real do período), "aiAnalysis": string (2-3 parágrafos cobrindo: situação atual dos números, crescimento/tendência comparado ao período anterior — cite os percentuais quando houver, e progresso em relação à meta definida quando houver uma), "recommendations": [{title, description, priority}] (3-5 recomendações futuras acionáveis para o próximo período, cobrindo conteúdo orgânico e, quando houver dados de ads, também tráfego pago) }
Seja específico e honesto com números — se algo caiu, diga que caiu e uma hipótese plausível do porquê; se cresceu, credite o trabalho realizado. Nunca invente números que não foram fornecidos.`,
      userPrompt: `Cliente: ${client.name} (${client.industry || 'sem segmento definido'})
Período: ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}
Meta/objetivo definido para este cliente: ${strategy?.objective || 'Nenhuma meta formal registrada.'}

=== CONTEÚDO ORGÂNICO ===
Conteúdos publicados: ${stats.contentsPublished}
Distribuição por tipo: ${JSON.stringify(stats.contentsByType)}
Aprovações enviadas ao cliente: ${stats.approvalsSent} (${stats.approvedCount} aprovadas de primeira, ${stats.changesRequestedCount} com pedido de ajuste)

${adsBlock}`,
    });

    const fixCurrency = (text: string) => !ads || ads.currency === 'BRL' ? text : String(text || '').replace(/R\$\s?/g, `${ads.currency} `).replace(/\bBRL\b/g, ads.currency);
    analysis.summary = fixCurrency(analysis.summary);
    analysis.aiAnalysis = fixCurrency(analysis.aiAnalysis);
    analysis.recommendations = (analysis.recommendations || []).map((r) => ({ ...r, title: fixCurrency(r.title), description: fixCurrency(r.description) }));

    const report = await prisma.report.create({
      data: {
        agencyId,
        clientId,
        title,
        periodStart: start,
        periodEnd: end,
        status: 'DRAFT',
        createdById: req.user!.id,
        summary: analysis.summary,
        aiAnalysis: analysis.aiAnalysis,
        recommendations: JSON.stringify(analysis.recommendations || []),
        snapshot: JSON.stringify({ ...stats, contents: published, ads, prevAds, adsGrowth, goal: strategy?.objective || null }),
      },
    });
    res.status(201).json(report);
  } catch (err) { next(err); }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const report = await prisma.report.findFirst({
      where: { id: req.params.id, agencyId: req.user!.agencyId },
      include: { client: true },
    });
    if (!report) throw new NotFoundError('Report not found');
    res.json(report);
  } catch (err) { next(err); }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { title, summary, aiAnalysis, recommendations } = req.body;
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { title, summary, aiAnalysis, recommendations: recommendations ? JSON.stringify(recommendations) : undefined },
    });
    res.json(report);
  } catch (err) { next(err); }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const report = await prisma.report.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId } });
    if (!report) throw new NotFoundError('Report not found');
    await prisma.report.delete({ where: { id: report.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function publish(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = uuidv4() + '-' + Date.now().toString(36);
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: 'PUBLISHED', publicToken: token },
    });

    const publicUrl = `${process.env.APP_URL || 'http://localhost:5173'}/report/${token}`;
    res.json({ ...report, publicUrl });
  } catch (err) { next(err); }
}

export async function getPublicReport(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await prisma.report.findUnique({
      where: { publicToken: req.params.token },
      include: { client: { select: { name: true } } },
    });
    if (!report || report.status !== 'PUBLISHED') throw new NotFoundError('Report not found');
    const adAccount = await prisma.socialConnection.findFirst({ where: { clientId: report.clientId, platform: 'META_ADS' }, select: { metadata: true } });
    let adsCurrency: string | null = null;
    try { adsCurrency = adAccount?.metadata ? JSON.parse(adAccount.metadata).currency || null : null; } catch { /* old connection */ }
    res.json({ ...report, adsCurrency });
  } catch (err) { next(err); }
}
