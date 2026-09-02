import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/middleware/errorHandler';
import { resolveAgencyAIProvider } from '../../integrations/ai/ai.provider';

interface AdsPeriodStats {
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  cpc: number;
  costPerResult: number | null;
  campaigns: { campaignName: string; spend: number; results: number }[];
}

// Pulls Meta Ads performance for a client's connected ad account(s) — same aggregation shape as
// the Ads page itself — for an arbitrary date range, so the report can show both the current
// period and, for growth comparison, the immediately preceding period of equal length. Returns
// null when the client has no connected ad account (reports for organic-only clients skip the
// ads section entirely rather than showing a wall of zeros).
async function aggregateAdsForPeriod(agencyId: string, clientId: string, start: Date, end: Date): Promise<AdsPeriodStats | null> {
  const connections = await prisma.socialConnection.findMany({
    where: { agencyId, clientId, platform: 'META_ADS' },
    select: { id: true },
  });
  if (!connections.length) return null;

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

  const byCampaign = new Map<string, { campaignName: string; spend: number; results: number }>();
  for (const r of rows) {
    const agg = byCampaign.get(r.campaignExternalId) || { campaignName: r.campaignName, spend: 0, results: 0 };
    agg.spend += r.spend; agg.results += r.results || 0;
    byCampaign.set(r.campaignExternalId, agg);
  }

  return {
    ...totals,
    ctr: totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks ? totals.spend / totals.clicks : 0,
    costPerResult: totals.results ? totals.spend / totals.results : null,
    campaigns: Array.from(byCampaign.values()).sort((a, b) => b.spend - a.spend).slice(0, 10),
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
      aggregateAdsForPeriod(agencyId, clientId, start, end),
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
Investimento: R$${ads.spend.toFixed(2)} | Impressões: ${ads.impressions} | Cliques: ${ads.clicks} | Resultados: ${ads.results} | CTR: ${ads.ctr.toFixed(2)}% | Custo/Resultado: ${ads.costPerResult != null ? `R$${ads.costPerResult.toFixed(2)}` : 'N/A'}
Campanhas: ${ads.campaigns.map((c) => `"${c.campaignName}" (gasto R$${c.spend.toFixed(2)}, ${c.results} resultados)`).join('; ') || 'nenhuma'}
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
    res.json(report);
  } catch (err) { next(err); }
}
