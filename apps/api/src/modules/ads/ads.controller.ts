import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
import { encrypt, decrypt } from '../../common/crypto';
import {
  GRAPH_URL, GRAPH_VERSION, buildMetaRedirectUri, getAgencyMetaCredentials, metaApiError,
} from '../../integrations/meta/metaClient';
import { resolveAgencyAIProvider } from '../../integrations/ai/ai.provider';

// `as any`: AdInsightDaily/AdRecommendation were added via a hand-applied migration while
// `prisma generate` couldn't reach binaries.prisma.sh, so the generated client's TS types don't
// know about them yet — drop this alias (and call `prisma.adInsightDaily`/`prisma.adRecommendation`
// directly) once `prisma generate` runs with network access.
const db = prisma as any;

// ─── CONNECT (Meta Ad Accounts) ────────────────────────────────────────────────

export async function adsConnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const credentials = await getAgencyMetaCredentials(req.user!.agencyId);
    if (!credentials) {
      return res.status(400).json({ error: 'Configure o Meta App ID e Secret da sua agência primeiro, em Redes Sociais.' });
    }
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    const client = await prisma.client.findFirst({ where: { id: String(clientId), agencyId: req.user!.agencyId } });
    if (!client) throw new NotFoundError('Client not found');

    // `flow: 'ads'` is how the shared callback in social.controller.ts (see its `metaCallback`)
    // knows to dispatch here instead of running its own Pages logic — this reuses that single
    // callback URL (already whitelisted on the agency's Meta App for Redes Sociais) instead of
    // requiring a second redirect_uri to be registered just for this module.
    const state = Buffer.from(JSON.stringify({ clientId, agencyId: req.user!.agencyId, userId: req.user!.id, flow: 'ads' })).toString('base64url');
    // ads_management is what lets "Aplicar" actually pause a campaign or change a budget —
    // it requires Meta App Review (Advanced Access) on the agency's own Meta App before it
    // works for real; ads_read alone still gets metrics + AI suggestions flowing.
    const scopes = ['ads_read', 'ads_management'].join(',');

    const authUrl = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?` + new URLSearchParams({
      client_id: credentials.appId,
      redirect_uri: buildMetaRedirectUri('/api/v1/social/meta/callback'),
      state,
      scope: scopes,
      response_type: 'code',
    }).toString();

    res.json({ authUrl });
  } catch (err) { next(err); }
}

async function connectAdAccountToClient(
  params: { agencyId: string; clientId: string; userId: string },
  account: { id: string; name: string; currency: string },
  accessToken: string
) {
  const where = { agencyId: params.agencyId, clientId: params.clientId, platform: 'META_ADS', externalPageId: account.id };
  const existing = await prisma.socialConnection.findFirst({ where });
  const data = {
    accountName: account.name,
    accessTokenEncrypted: encrypt(accessToken),
    status: 'ACTIVE',
    connectedBy: params.userId,
    metadata: JSON.stringify({ currency: account.currency }),
  };
  if (existing) return prisma.socialConnection.update({ where: { id: existing.id }, data });
  return prisma.socialConnection.create({ data: { ...where, ...data } });
}

// Ad accounts pending a picker, same pattern as the Page picker in social.controller.ts — an
// agency's Business Manager can have partner access to several clients' ad accounts at once,
// so `/me/adaccounts` may return more than belongs to the client being connected.
const ADS_PENDING_TTL_MS = 10 * 60 * 1000;
const pendingAdAccountSelections = new Map<string, {
  agencyId: string; clientId: string; userId: string; expiresAt: number; accessToken: string;
  accounts: Array<{ id: string; name: string; currency: string }>;
}>();

function cleanupExpiredAdPendingSelections() {
  const now = Date.now();
  for (const [token, entry] of pendingAdAccountSelections) {
    if (entry.expiresAt < now) pendingAdAccountSelections.delete(token);
  }
}

// Called from social.controller.ts's shared Meta callback (see the `flow === 'ads'` branch
// there) instead of registering a second OAuth redirect_uri — Meta only allows a request to
// redirect to a URI that's been explicitly whitelisted on the App, and asking every agency to
// add a second URL just for this module (on top of the one they already added for Redes
// Sociais) is exactly the kind of setup friction the guided wizard exists to avoid. The code
// exchange already happened by the time this runs; this just does the ad-accounts-specific part
// (as opposed to the Pages-specific part social.controller.ts handles for its own flow) and
// returns the query string to redirect the browser to.
export async function handleAdsMetaAuth(params: { agencyId: string; clientId: string; userId: string; accessToken: string }): Promise<string> {
  const { agencyId, clientId, userId, accessToken } = params;

  const accountsRes = await fetch(`${GRAPH_URL}/me/adaccounts?fields=id,name,currency&access_token=${accessToken}`);
  const accountsData = await accountsRes.json() as any;
  if (!accountsRes.ok) throw new Error(accountsData.error?.message || 'Failed to list ad accounts');

  const accounts = accountsData.data || [];
  if (accounts.length === 0) return 'ads_error=1&reason=no_accounts';

  if (accounts.length > 1) {
    cleanupExpiredAdPendingSelections();
    const token = Buffer.from(`${Date.now()}-${Math.random().toString(36).slice(2)}`).toString('base64url');
    pendingAdAccountSelections.set(token, { agencyId, clientId, userId, expiresAt: Date.now() + ADS_PENDING_TTL_MS, accessToken, accounts });
    return `ads_select_account=1&token=${token}&clientId=${clientId}`;
  }

  await connectAdAccountToClient({ agencyId, clientId, userId }, accounts[0], accessToken);
  return `ads_connected=1&clientId=${clientId}`;
}

export async function getPendingAdAccountSelection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    cleanupExpiredAdPendingSelections();
    const entry = pendingAdAccountSelections.get(req.params.token);
    if (!entry || entry.agencyId !== req.user!.agencyId) throw new NotFoundError('Seleção expirada ou inválida. Clique em Conectar novamente.');
    res.json({ clientId: entry.clientId, accounts: entry.accounts });
  } catch (err) { next(err); }
}

export async function confirmAdAccountSelection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    cleanupExpiredAdPendingSelections();
    const entry = pendingAdAccountSelections.get(req.params.token);
    if (!entry || entry.agencyId !== req.user!.agencyId) throw new NotFoundError('Seleção expirada ou inválida. Clique em Conectar novamente.');

    const { accountIds } = req.body as { accountIds: string[] };
    if (!Array.isArray(accountIds) || accountIds.length === 0) throw new ValidationError('Selecione pelo menos uma conta.');

    const selected = entry.accounts.filter((a) => accountIds.includes(a.id));
    for (const account of selected) {
      await connectAdAccountToClient({ agencyId: entry.agencyId, clientId: entry.clientId, userId: entry.userId }, account, entry.accessToken);
    }
    pendingAdAccountSelections.delete(req.params.token);
    res.json({ connected: selected.length });
  } catch (err) { next(err); }
}

// ─── AD ACCOUNTS (list/remove) ─────────────────────────────────────────────────

export async function listAdAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.query;
    const where: any = { agencyId: req.user!.agencyId, platform: 'META_ADS' };
    if (clientId) where.clientId = clientId;

    const accounts = await prisma.socialConnection.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(accounts.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      accountName: a.accountName,
      externalAccountId: a.externalPageId,
      status: a.status,
      connectedAt: a.createdAt,
      currency: a.metadata ? JSON.parse(a.metadata).currency : null,
    })));
  } catch (err) { next(err); }
}

export async function deleteAdAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const connection = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId, platform: 'META_ADS' } });
    if (!connection) throw new NotFoundError('Ad account not found');
    await prisma.socialConnection.delete({ where: { id: connection.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// ─── SYNC (daily performance snapshot) ─────────────────────────────────────────

// Pulls the last 7 days of campaign-level insights (one bucket per day, via time_increment=1)
// plus each campaign's live status, and upserts them into AdInsightDaily. Called both by the
// manual "Atualizar agora" endpoint below and by the background job (jobs/adsSync.ts) — kept
// as a plain exported function (not an HTTP handler) so both call sites share one code path.
export async function syncAdAccountInsights(connection: {
  id: string; agencyId: string; clientId: string; externalPageId: string | null; accessTokenEncrypted: string | null;
}) {
  if (!connection.externalPageId || !connection.accessTokenEncrypted) return;
  const accessToken = decrypt(connection.accessTokenEncrypted);
  const actId = connection.externalPageId;

  const [campaignsRes, insightsRes] = await Promise.all([
    fetch(`${GRAPH_URL}/${actId}/campaigns?fields=id,name,effective_status&limit=200&access_token=${accessToken}`),
    fetch(`${GRAPH_URL}/${actId}/insights?level=campaign&date_preset=last_7d&time_increment=1&fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type&limit=500&access_token=${accessToken}`),
  ]);
  if (!campaignsRes.ok) throw await metaApiError(campaignsRes);
  if (!insightsRes.ok) throw await metaApiError(insightsRes);

  const campaignsData = await campaignsRes.json() as any;
  const insightsData = await insightsRes.json() as any;
  const statusByCampaign = new Map<string, string>((campaignsData.data || []).map((c: any) => [c.id, c.effective_status]));

  for (const row of insightsData.data || []) {
    // Meta returns every action type the ad triggered (leads, messages, purchases, ...) — we
    // take the first as "the" result metric for now rather than building full multi-goal
    // tracking, which is enough for the AI to reason about cost-per-result trends.
    const primaryAction = row.actions?.[0];
    const primaryCost = row.cost_per_action_type?.find((c: any) => c.action_type === primaryAction?.action_type);

    const values = {
      campaignName: row.campaign_name,
      status: statusByCampaign.get(row.campaign_id) || 'UNKNOWN',
      spend: Number(row.spend || 0),
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      ctr: Number(row.ctr || 0),
      cpc: Number(row.cpc || 0),
      results: primaryAction ? Number(primaryAction.value) : null,
      costPerResult: primaryCost ? Number(primaryCost.value) : null,
    };

    await db.adInsightDaily.upsert({
      // `as any`: compound unique `connectionId_campaignExternalId_date` isn't in the stale
      // generated client types yet (prisma generate can't reach binaries.prisma.sh here).
      where: {
        connectionId_campaignExternalId_date: {
          connectionId: connection.id,
          campaignExternalId: row.campaign_id,
          date: new Date(row.date_start),
        },
      } as any,
      create: {
        agencyId: connection.agencyId,
        clientId: connection.clientId,
        connectionId: connection.id,
        date: new Date(row.date_start),
        campaignExternalId: row.campaign_id,
        ...values,
      },
      update: values,
    });
  }
}

export async function syncAdAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const connection = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId, platform: 'META_ADS' } });
    if (!connection) throw new NotFoundError('Ad account not found');
    await syncAdAccountInsights(connection);
    res.json({ synced: true });
  } catch (err) { next(err); }
}

// ─── INSIGHTS (read synced data) ───────────────────────────────────────────────

export async function getAdInsights(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const connection = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId, platform: 'META_ADS' } });
    if (!connection) throw new NotFoundError('Ad account not found');

    const range = req.query.range === '30d' ? 30 : 7;
    const since = new Date();
    since.setDate(since.getDate() - range);

    const rows = await db.adInsightDaily.findMany({
      where: { connectionId: connection.id, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    const totals = rows.reduce(
      (acc: { spend: number; impressions: number; clicks: number; results: number }, r: any) => {
        acc.spend += r.spend; acc.impressions += r.impressions; acc.clicks += r.clicks; acc.results += r.results || 0;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, results: 0 }
    );

    const byCampaign = new Map<string, { campaignExternalId: string; campaignName: string; status: string; spend: number; impressions: number; clicks: number; results: number }>();
    for (const r of rows) {
      const agg = byCampaign.get(r.campaignExternalId) || {
        campaignExternalId: r.campaignExternalId, campaignName: r.campaignName, status: r.status,
        spend: 0, impressions: 0, clicks: 0, results: 0,
      };
      agg.spend += r.spend; agg.impressions += r.impressions; agg.clicks += r.clicks; agg.results += r.results || 0;
      agg.status = r.status; agg.campaignName = r.campaignName;
      byCampaign.set(r.campaignExternalId, agg);
    }

    res.json({
      totals: {
        ...totals,
        ctr: totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0,
        cpc: totals.clicks ? totals.spend / totals.clicks : 0,
        costPerResult: totals.results ? totals.spend / totals.results : null,
      },
      campaigns: Array.from(byCampaign.values()).sort((a, b) => b.spend - a.spend),
      lastSyncedAt: rows.length ? rows[rows.length - 1].createdAt : null,
    });
  } catch (err) { next(err); }
}

// ─── AI ANALYSIS + RECOMMENDATIONS ─────────────────────────────────────────────

export async function analyzeAdAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const connection = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId, platform: 'META_ADS' } });
    if (!connection) throw new NotFoundError('Ad account not found');

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const rows = await db.adInsightDaily.findMany({ where: { connectionId: connection.id, date: { gte: since } } });
    if (!rows.length) throw new ValidationError('Nenhum dado sincronizado ainda — clique em "Atualizar agora" primeiro.');

    const byCampaign = new Map<string, { name: string; status: string; spend: number; clicks: number; impressions: number; results: number }>();
    for (const r of rows) {
      const agg = byCampaign.get(r.campaignExternalId) || { name: r.campaignName, status: r.status, spend: 0, clicks: 0, impressions: 0, results: 0 };
      agg.spend += r.spend; agg.clicks += r.clicks; agg.impressions += r.impressions; agg.results += r.results || 0;
      agg.status = r.status;
      byCampaign.set(r.campaignExternalId, agg);
    }

    const client = await prisma.client.findFirst({ where: { id: connection.clientId, agencyId: req.user!.agencyId } });
    const ai = await resolveAgencyAIProvider(req.user!.agencyId, 'text');

    const analysis = await ai.generateJSON<{
      recommendations: { campaignExternalId: string; campaignName: string; actionType: string; actionParams?: { newDailyBudgetCents?: number }; reasoning: string }[];
    }>({
      systemPrompt: `Você é um especialista sênior em tráfego pago (Meta Ads) analisando a performance de campanhas dos últimos 7 dias de um cliente de agência. Para cada campanha que precisa de atenção, sugira UMA ação clara e específica.
Retorne SOMENTE JSON, sem markdown: { "recommendations": [{ "campaignExternalId": string, "campaignName": string, "actionType": "PAUSE" | "INCREASE_BUDGET" | "DECREASE_BUDGET" | "ADVISORY", "actionParams": {"newDailyBudgetCents": number} (obrigatório só para INCREASE_BUDGET/DECREASE_BUDGET, valor em centavos), "reasoning": string (2-3 frases em português, citando os números concretos) }] }
Use "PAUSE" para campanhas com gasto alto e poucos ou nenhum resultado. Use "INCREASE_BUDGET" para campanhas com custo por resultado muito bom (vale escalar). Use "DECREASE_BUDGET" para campanhas gastando acima do razoável pro resultado que entregam, sem justificar pausa total. Use "ADVISORY" para casos que precisam de revisão de criativo/segmentação, sem ação direta de orçamento. Só recomende campanhas com algo genuinamente acionável — não force uma recomendação por campanha se ela está saudável.`,
      userPrompt: `Cliente: ${client?.name || 'Cliente'}\nCampanhas (últimos 7 dias):\n${Array.from(byCampaign.entries())
        .map(([id, c]) => `- [${id}] "${c.name}" (status: ${c.status}) — gasto: R$${c.spend.toFixed(2)}, cliques: ${c.clicks}, impressões: ${c.impressions}, resultados: ${c.results}, custo/resultado: ${c.results ? (c.spend / c.results).toFixed(2) : 'N/A'}`)
        .join('\n')}`,
    });

    const created = await Promise.all(
      (analysis.recommendations || []).map((r) =>
        db.adRecommendation.create({
          data: {
            agencyId: req.user!.agencyId,
            clientId: connection.clientId,
            connectionId: connection.id,
            campaignExternalId: r.campaignExternalId,
            campaignName: r.campaignName,
            actionType: r.actionType,
            actionParams: r.actionParams ? JSON.stringify(r.actionParams) : null,
            reasoning: r.reasoning,
          },
        })
      )
    );

    res.status(201).json(created);
  } catch (err) { next(err); }
}

export async function listRecommendations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, connectionId, status } = req.query;
    const where: any = { agencyId: req.user!.agencyId };
    if (clientId) where.clientId = clientId;
    if (connectionId) where.connectionId = connectionId;
    if (status) where.status = status;

    const recs = await db.adRecommendation.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json(recs);
  } catch (err) { next(err); }
}

export async function applyRecommendation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rec = await db.adRecommendation.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId } });
    if (!rec) throw new NotFoundError('Recommendation not found');
    if (rec.status !== 'PENDING') throw new ValidationError('Esta recomendação já foi aplicada ou dispensada.');
    if (rec.actionType === 'ADVISORY') throw new ValidationError('Esta recomendação é apenas informativa — não há ação automática pra aplicar.');

    const connection = await prisma.socialConnection.findFirst({ where: { id: rec.connectionId, agencyId: req.user!.agencyId } });
    if (!connection?.accessTokenEncrypted) throw new NotFoundError('Conta de anúncios não encontrada ou desconectada.');
    const accessToken = decrypt(connection.accessTokenEncrypted);

    let body: Record<string, any> = {};
    if (rec.actionType === 'PAUSE') {
      body = { status: 'PAUSED' };
    } else if (rec.actionType === 'INCREASE_BUDGET' || rec.actionType === 'DECREASE_BUDGET') {
      const params = rec.actionParams ? JSON.parse(rec.actionParams) : {};
      if (!params.newDailyBudgetCents) throw new ValidationError('Recomendação sem valor de orçamento definido.');
      body = { daily_budget: params.newDailyBudgetCents };
    } else {
      throw new ValidationError('Tipo de ação desconhecido.');
    }

    const applyRes = await fetch(`${GRAPH_URL}/${rec.campaignExternalId}?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!applyRes.ok) throw await metaApiError(applyRes);

    const updated = await db.adRecommendation.update({
      where: { id: rec.id },
      data: { status: 'APPLIED', appliedAt: new Date(), appliedBy: req.user!.id },
    });
    res.json(updated);
  } catch (err) { next(err); }
}

export async function dismissRecommendation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rec = await db.adRecommendation.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId } });
    if (!rec) throw new NotFoundError('Recommendation not found');
    const updated = await db.adRecommendation.update({ where: { id: rec.id }, data: { status: 'DISMISSED' } });
    res.json(updated);
  } catch (err) { next(err); }
}
