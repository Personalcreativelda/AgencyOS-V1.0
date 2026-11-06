import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { AIProviderError, NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
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

// Meta's `actions` array lists every action type the ad triggered (link clicks, page/post
// engagement, messaging steps, leads, purchases, ...) in whatever order its API returns them —
// NOT ranked by relevance. Blindly taking `actions[0]` as "the" result (the old behavior) picked
// up `link_click` for a real click-to-message campaign here, confirmed live: Meta's own Ads
// Manager showed the campaign's actual "Resultados" as messaging conversations started (5), but
// this app showed 33 (link clicks) instead — a materially different, misleading number. This
// priority list mirrors what Meta's Ads Manager itself treats as the meaningful outcome per
// objective (highest-intent first — a purchase or lead means more than a generic page like), and
// picks the first one actually present on the row; unrecognized objectives fall back to
// `actions[0]` same as before, so nothing regresses for cases this list doesn't cover yet.
const RESULT_ACTION_PRIORITY = [
  'purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_conversion.purchase',
  'lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead',
  'onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.total_messaging_connection',
  'complete_registration', 'onsite_conversion.complete_registration',
  'link_click',
  'post_engagement', 'page_engagement', 'like',
];

function pickPrimaryAction(actions: Array<{ action_type: string; value: string }> | undefined) {
  if (!actions?.length) return undefined;
  for (const type of RESULT_ACTION_PRIORITY) {
    const found = actions.find((a) => a.action_type === type);
    if (found) return found;
  }
  return actions[0];
}

// Contact events are reported in aggregate by Meta. The priority avoids counting the same
// conversation twice when Meta includes both messaging and lead action types in one row.
const CONTACT_ACTION_PRIORITY = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.total_messaging_connection',
  'lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead',
];

function contactCount(actions: Array<{ action_type: string; value: string }> | undefined): number {
  for (const type of CONTACT_ACTION_PRIORITY) {
    const action = actions?.find((a) => a.action_type === type);
    if (action) return Number(action.value) || 0;
  }
  return 0;
}

// Meta's own names for placements aren't very readable on their own ("facebook" + "feed" as two
// separate fields) — maps the (publisher_platform, platform_position) pair Meta returns into the
// label an agency actually recognizes from Ads Manager.
const PLACEMENT_LABELS: Record<string, string> = {
  'facebook.feed': 'Facebook Feed',
  'facebook.facebook_reels': 'Facebook Reels',
  'facebook.facebook_stories': 'Facebook Stories',
  'facebook.marketplace': 'Facebook Marketplace',
  'facebook.search': 'Facebook Search',
  'facebook.instream_video': 'Facebook In-Stream Video',
  'facebook.right_hand_column': 'Facebook Coluna Direita',
  'instagram.feed': 'Instagram Feed',
  'instagram.instagram_reels': 'Instagram Reels',
  'instagram.instagram_stories': 'Instagram Stories',
  'instagram.explore': 'Instagram Explorar',
  'messenger.messenger_home': 'Messenger',
  'audience_network.an_classic': 'Audience Network',
  'audience_network.rewarded_video': 'Audience Network (Vídeo Recompensado)',
};

function placementLabel(publisherPlatform: string, platformPosition: string): string {
  return PLACEMENT_LABELS[`${publisherPlatform}.${platformPosition}`] || `${publisherPlatform} · ${platformPosition}`;
}

function genderLabel(gender: string): string {
  return gender === 'male' ? 'Masculino' : gender === 'female' ? 'Feminino' : 'Não informado';
}

async function fetchAllMetaInsightRows(url: string): Promise<any[]> {
  const rows: any[] = [];
  let next: string | undefined = url;
  let pages = 0;
  while (next) {
    if (++pages > 20) throw new Error('A Meta retornou mais páginas de dados do que é possível analisar de uma vez.');
    const response = await fetch(next);
    if (!response.ok) throw await metaApiError(response);
    const payload = await response.json() as { data?: any[]; paging?: { next?: string } };
    rows.push(...(payload.data || []));
    next = payload.paging?.next;
  }
  return rows;
}

// Aggregates one Meta breakdown response (age/gender, placement, or region — anything shaped as
// [{ ...dims, spend, impressions, clicks, actions }]) into a sorted top-N list keyed by a
// human-readable label. `results` uses the same pickPrimaryAction priority as the main sync, so
// a segment's "results" here means the same thing as the campaign-level "Resultados" card.
function aggregateBreakdown(
  rows: any[],
  labelFor: (row: any) => string | null,
  campaignFilter: string | undefined,
  limit = 6
) {
  const scoped = campaignFilter ? rows.filter((r) => r.campaign_id === campaignFilter) : rows;
  const map = new Map<string, { label: string; spend: number; impressions: number; clicks: number; results: number; contacts: number }>();
  for (const row of scoped) {
    const label = labelFor(row);
    if (!label) continue;
    const agg = map.get(label) || { label, spend: 0, impressions: 0, clicks: 0, results: 0, contacts: 0 };
    agg.spend += Number(row.spend || 0);
    agg.impressions += Number(row.impressions || 0);
    agg.clicks += Number(row.clicks || 0);
    const primary = pickPrimaryAction(row.actions);
    agg.results += primary ? Number(primary.value) : 0;
    agg.contacts += contactCount(row.actions);
    map.set(label, agg);
  }
  return Array.from(map.values())
    .sort((a, b) => b.contacts - a.contacts || b.results - a.results || b.spend - a.spend)
    .slice(0, limit);
}

// Live-fetched from Meta on demand (not persisted like AdInsightDaily) — this is drill-down
// context for strategy, not something the 30-minute background sync needs to carry for every
// account on every run. Powers both the "Público" card on the Ads page and the richer context
// handed to the AI in analyzeAdAccount below, so a recommendation like "aumentar orçamento" can
// actually be informed by WHO is converting and WHERE, not just aggregate spend/results.
async function fetchCampaignContext(
  connection: { externalPageId: string | null; accessTokenEncrypted: string | null },
  days: number,
  campaignFilter?: string
) {
  const accessToken = decrypt(connection.accessTokenEncrypted!);
  const actId = connection.externalPageId!;
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const timeRange = JSON.stringify({ since: fmt(since), until: fmt(until) });
  const period = days === 1 ? 'date_preset=today' : `time_range=${encodeURIComponent(timeRange)}`;
  const base = `${GRAPH_URL}/${actId}/insights?level=campaign&${period}&access_token=${accessToken}`;

  const [demoRows, placementRows, regionRows, reachRowsAll, actionRowsAll] = await Promise.all([
    fetchAllMetaInsightRows(`${base}&breakdowns=age,gender&fields=campaign_id,campaign_name,spend,impressions,clicks,actions&limit=500`),
    fetchAllMetaInsightRows(`${base}&breakdowns=publisher_platform,platform_position&fields=campaign_id,campaign_name,spend,impressions,clicks,actions&limit=500`),
    fetchAllMetaInsightRows(`${base}&breakdowns=region&fields=campaign_id,campaign_name,spend,impressions,clicks,actions&limit=500`),
    fetchAllMetaInsightRows(`${base}&fields=campaign_id,campaign_name,frequency,reach&limit=500`),
    fetchAllMetaInsightRows(`${base}&fields=campaign_id,actions&limit=500`),
  ]);

  const demographics = aggregateBreakdown(
    demoRows,
    (r) => (r.age && r.gender ? `${r.age} · ${genderLabel(r.gender)}` : null),
    campaignFilter
  );
  const placements = aggregateBreakdown(
    placementRows,
    (r) => (r.publisher_platform && r.platform_position ? placementLabel(r.publisher_platform, r.platform_position) : null),
    campaignFilter
  );
  const regions = aggregateBreakdown(
    regionRows,
    (r) => r.region || null,
    campaignFilter,
    5
  );

  // Frequency/reach have no breakdown — one row per campaign already, average by spend since a
  // simple mean would let a barely-spending campaign skew the blended number as much as the main
  // one when several campaigns are in scope.
  const reachRows = reachRowsAll.filter((r: any) => !campaignFilter || r.campaign_id === campaignFilter);
  const totalReachSpend = reachRows.reduce((s: number, r: any) => s + 1, 0);
  const avgFrequency = totalReachSpend
    ? reachRows.reduce((s: number, r: any) => s + Number(r.frequency || 0), 0) / totalReachSpend
    : null;
  const totalReach = reachRows.reduce((s: number, r: any) => s + Number(r.reach || 0), 0);

  const actionRows = actionRowsAll.filter((r: any) => !campaignFilter || r.campaign_id === campaignFilter);
  const contacts = actionRows.reduce((sum: number, row: any) => sum + contactCount(row.actions), 0);
  const linkClicks = actionRows.reduce((sum: number, row: any) =>
    sum + Number(row.actions?.find((a: any) => a.action_type === 'link_click')?.value || 0), 0);

  return { demographics, placements, regions, frequency: avgFrequency, reach: totalReach || null,
    contacts, linkClicks, contactRate: linkClicks ? contacts / linkClicks * 100 : null };
}

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

  // Meta's `date_preset=last_7d` means "the 7 days before today, NOT including today" — a
  // campaign that only started spending today (confirmed live: two real campaigns created same-
  // day, one with a single impression, returned a completely empty insights response under
  // last_7d) would show zero data for its entire lifetime until tomorrow. An explicit time_range
  // including today sidesteps that. Widened to 30 days (not just 7) so the "30 dias" toggle on
  // the Ads page has real daily buckets to show instead of silently reusing the 7-day sync.
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 29);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const timeRange = JSON.stringify({ since: fmt(since), until: fmt(until) });

  const [campaignsRes, insightRows] = await Promise.all([
    fetch(`${GRAPH_URL}/${actId}/campaigns?fields=id,name,effective_status&limit=200&access_token=${accessToken}`),
    fetchAllMetaInsightRows(`${GRAPH_URL}/${actId}/insights?level=campaign&time_range=${encodeURIComponent(timeRange)}&time_increment=1&fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type&limit=500&access_token=${accessToken}`),
  ]);
  if (!campaignsRes.ok) throw await metaApiError(campaignsRes);

  const campaignsData = await campaignsRes.json() as any;
  const statusByCampaign = new Map<string, string>((campaignsData.data || []).map((c: any) => [c.id, c.effective_status]));

  for (const row of insightRows) {
    const primaryAction = pickPrimaryAction(row.actions);
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

export async function getMetaPerformanceInsights(connection: {
  id: string; agencyId: string; clientId: string; externalPageId: string | null;
  accessTokenEncrypted: string | null; metadata: string | null;
}, days: number, refresh = false) {
  if (!connection.externalPageId || !connection.accessTokenEncrypted) {
    throw new ValidationError('Conta Meta Ads sem credenciais. Conecte novamente.');
  }
  let rows: Array<{ date: string; spend: number; impressions: number; clicks: number; results: number }>;
  let source: 'live' | 'synced';
  let lastSyncedAt: string | null = null;
  if (days <= 30 && days > 1) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - days + 1);
    if (refresh) await syncAdAccountInsights(connection);
    let stored = await db.adInsightDaily.findMany({ where: { connectionId: connection.id, date: { gte: since } } });
    if (!stored.length && !refresh) {
      await syncAdAccountInsights(connection);
      stored = await db.adInsightDaily.findMany({ where: { connectionId: connection.id, date: { gte: since } } });
    }
    rows = stored.map((row: any) => ({ date: new Date(row.date).toISOString().slice(0, 10),
      spend: Number(row.spend || 0), impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0), results: Number(row.results || 0) }));
    const last = await prisma.$queryRaw<{ max: Date | null }[]>`
      SELECT MAX(updated_at) as max FROM ad_insights_daily WHERE connection_id = ${connection.id} AND date >= ${since}
    `;
    lastSyncedAt = last[0]?.max?.toISOString() || null;
    source = 'synced';
  } else {
    const token = decrypt(connection.accessTokenEncrypted);
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days + 1);
    const timeRange = JSON.stringify({ since: start.toISOString().slice(0, 10), until: end.toISOString().slice(0, 10) });
    const period = days === 1 ? 'date_preset=today' : `time_range=${encodeURIComponent(timeRange)}&time_increment=1`;
    const url = `${GRAPH_URL}/${connection.externalPageId}/insights?level=campaign&${period}&fields=campaign_id,date_start,spend,impressions,clicks,actions&limit=500&access_token=${token}`;
    const live = await fetchAllMetaInsightRows(url);
    rows = live.map((row: any) => ({ date: row.date_start || end.toISOString().slice(0, 10),
      spend: Number(row.spend || 0), impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0), results: Number(pickPrimaryAction(row.actions)?.value || 0) }));
    source = 'live';
    lastSyncedAt = new Date().toISOString();
  }
  const daily = new Map<string, { date: string; spend: number; impressions: number; clicks: number; results: number }>();
  for (const row of rows) {
    const day = daily.get(row.date) || { date: row.date, spend: 0, impressions: 0, clicks: 0, results: 0 };
    day.spend += row.spend; day.impressions += row.impressions; day.clicks += row.clicks; day.results += row.results;
    daily.set(row.date, day);
  }
  const totals = [...daily.values()].reduce((sum, row) => ({
    spend: sum.spend + row.spend, impressions: sum.impressions + row.impressions,
    clicks: sum.clicks + row.clicks, results: sum.results + row.results,
  }), { spend: 0, impressions: 0, clicks: 0, results: 0 });
  let currency: string | null = null;
  try { currency = connection.metadata ? JSON.parse(connection.metadata).currency || null : null; } catch { /* old connection */ }
  return { clientId: connection.clientId, connectionId: connection.id, currency, source, lastSyncedAt,
    totals, daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export async function syncAdAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const connection = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId, platform: 'META_ADS' } });
    if (!connection) throw new NotFoundError('Ad account not found');
    await syncAdAccountInsights(connection);
    res.json({ synced: true });
  } catch (err) { next(err); }
}

// ─── CAMPAIGN CONTROLS (manual, outside the AI recommendation flow) ───────────

// Direct pause/reactivate from the campaigns table — same Meta call the "PAUSE" AI
// recommendation makes via applyRecommendation below, just without requiring a recommendation
// to exist first. Requires ads_management (requested at connect time in adsConnect).
export async function setCampaignStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status } = req.body as { status?: string };
    if (status !== 'ACTIVE' && status !== 'PAUSED') {
      throw new ValidationError('status must be ACTIVE or PAUSED');
    }
    const connection = await prisma.socialConnection.findFirst({
      where: { id: req.params.id, agencyId: req.user!.agencyId, platform: 'META_ADS' },
    });
    if (!connection?.accessTokenEncrypted) throw new NotFoundError('Ad account not found or disconnected');
    const accessToken = decrypt(connection.accessTokenEncrypted);

    const metaRes = await fetch(`${GRAPH_URL}/${req.params.campaignId}?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!metaRes.ok) throw await metaApiError(metaRes);

    // Reflect immediately in whatever's already synced, so the table doesn't show the old
    // status until the next scheduled/manual sync — cosmetic only, syncAdAccountInsights
    // overwrites it with Meta's own effective_status on the next real sync regardless.
    await db.adInsightDaily.updateMany({
      where: { connectionId: connection.id, campaignExternalId: req.params.campaignId },
      data: { status },
    });

    res.json({ campaignId: req.params.campaignId, status });
  } catch (err) { next(err); }
}

// Read-only creative previews. Existing insights and campaign controls keep their contracts.
export async function getCampaignCreatives(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = req.params.campaignId;
    if (!/^\d+$/.test(campaignId)) throw new ValidationError('Campanha inválida.');
    const connection = await prisma.socialConnection.findFirst({
      where: { id: req.params.id, agencyId: req.user!.agencyId, platform: 'META_ADS' },
    });
    if (!connection?.accessTokenEncrypted || !connection.externalPageId) throw new NotFoundError('Conta de anúncios não encontrada ou desconectada.');
    const token = decrypt(connection.accessTokenEncrypted);
    // A campaign ID alone must never allow a token with access to other clients to cross accounts.
    const campaignResponse = await fetch(`${GRAPH_URL}/${campaignId}?` + new URLSearchParams({ fields: 'account_id', access_token: token }));
    if (!campaignResponse.ok) throw await metaApiError(campaignResponse);
    const campaign = await campaignResponse.json() as { account_id?: string };
    if (campaign.account_id !== connection.externalPageId.replace(/^act_/, '')) throw new NotFoundError('Campanha não encontrada nesta conta.');
    const ads = await fetchAllMetaInsightRows(`${GRAPH_URL}/${campaignId}/ads?` + new URLSearchParams({
      fields: 'id,name,effective_status,creative{id,name,image_url,thumbnail_url,video_id}',
      limit: '100', access_token: token,
    }));
    // Boosted posts often only expose a tiny default thumbnail. Ask Meta for a larger
    // poster when no original image is available, retaining the small one on failure.
    const posterIds = [...new Set<string>(ads.filter(ad => !ad.creative?.image_url && ad.creative?.thumbnail_url && /^\d+$/.test(ad.creative?.id || '')).map(ad => ad.creative.id))].slice(0, 12);
    const posters = new Map<string, any>();
    for (let start = 0; start < posterIds.length; start += 4) {
      await Promise.all(posterIds.slice(start, start + 4).map(async id => {
        try {
          const response = await fetch(`${GRAPH_URL}/${id}?` + new URLSearchParams({
            fields: 'image_url,thumbnail_url', thumbnail_width: '800', thumbnail_height: '800', access_token: token,
          }), { signal: AbortSignal.timeout(10000) });
          if (response.ok) posters.set(id, await response.json());
        } catch { /* The existing preview remains usable if a larger poster is unavailable. */ }
      }));
    }
    for (const ad of ads) {
      const poster = posters.get(ad.creative?.id);
      if (poster) ad.creative = { ...ad.creative, image_url: poster.image_url || ad.creative.image_url, thumbnail_url: poster.thumbnail_url || ad.creative.thumbnail_url };
    }
    const safeImage = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      try { const url = new URL(value); return url.protocol === 'https:' && !url.searchParams.has('access_token') ? url.toString() : null; } catch { return null; }
    };
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ campaignId, ads: ads.map(ad => ({
      id: String(ad.id), name: ad.name || ad.creative?.name || 'Anúncio', status: ad.effective_status || 'UNKNOWN',
      imageUrl: safeImage(ad.creative?.image_url), thumbnailUrl: safeImage(ad.creative?.thumbnail_url),
      isVideo: Boolean(ad.creative?.video_id),
    })) });
  } catch (err) { next(err); }
}

// ─── INSIGHTS (read synced data) ───────────────────────────────────────────────

export async function getAdInsights(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const connection = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId, platform: 'META_ADS' } });
    if (!connection) throw new NotFoundError('Ad account not found');

    const isToday = req.query.range === 'today';

    // Today is read live from Meta. Its `today` preset follows the ad account's own day,
    // while server-local/UTC date boundaries could select yesterday for another timezone.
    let rows: any[];
    let lastSyncedAt: Date | null;
    if (isToday) {
      if (!connection.accessTokenEncrypted || !connection.externalPageId) throw new NotFoundError('Ad account not found or disconnected');
      const accessToken = decrypt(connection.accessTokenEncrypted);
      const actId = connection.externalPageId;
      const [campaigns, insights] = await Promise.all([
        fetchAllMetaInsightRows(`${GRAPH_URL}/${actId}/campaigns?fields=id,name,effective_status&limit=200&access_token=${accessToken}`),
        fetchAllMetaInsightRows(`${GRAPH_URL}/${actId}/insights?level=campaign&date_preset=today&fields=campaign_id,campaign_name,spend,impressions,clicks,actions&limit=500&access_token=${accessToken}`),
      ]);
      const statusByCampaign = new Map<string, string>(campaigns.map((c: any) => [c.id, c.effective_status]));
      rows = insights.map((row: any) => ({
        campaignExternalId: row.campaign_id,
        campaignName: row.campaign_name,
        status: statusByCampaign.get(row.campaign_id) || 'UNKNOWN',
        spend: Number(row.spend || 0),
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        results: Number(pickPrimaryAction(row.actions)?.value || 0),
      }));
      lastSyncedAt = new Date();
    } else {
      const range = req.query.range === '30d' ? 30 : 7;
      const since = new Date();
      since.setDate(since.getDate() - range);

      // `updated_at`: read via raw SQL, not the typed `adInsightDaily` delegate — the column was
      // added by a hand-applied migration while `prisma generate` can't reach binaries.prisma.sh
      // (same constraint noted elsewhere in this file), so the generated client doesn't know the
      // field exists and silently omits it from `findMany()` results (confirmed live: came back
      // `undefined` on every row). `createdAt` was the fallback before this column existed, but an
      // upsert's update branch never touches it, so a row synced daily for weeks reports the
      // timestamp of its very first creation forever — making genuinely fresh data look stale.
      const lastSyncRows = await prisma.$queryRaw<{ max: Date | null }[]>`
        SELECT MAX(updated_at) as max FROM ad_insights_daily WHERE connection_id = ${connection.id} AND date >= ${since}
      `;
      lastSyncedAt = lastSyncRows[0]?.max ?? null;

      rows = await db.adInsightDaily.findMany({
        where: { connectionId: connection.id, date: { gte: since } },
        orderBy: { date: 'asc' },
      });
    }

    // `campaignExternalId` scopes both the totals cards and lastSyncedAt to one campaign — the
    // account can have several campaigns delivering at very different scales, and blending them
    // into one CTR/CPC average (e.g. one campaign at ZAR 0,56 CPC, another at ZAR 3+ CPC) reads
    // as "wrong" next to what Meta's own app shows for a single campaign, even though the math is
    // correct for the combined account. `campaigns` below always lists every campaign regardless
    // of this filter, each with its own derived rates, so the frontend can offer a picker without
    // a second round-trip.
    const campaignFilter = typeof req.query.campaignExternalId === 'string' ? req.query.campaignExternalId : undefined;
    const scopedRows = campaignFilter ? rows.filter((r: any) => r.campaignExternalId === campaignFilter) : rows;

    const totals = scopedRows.reduce(
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
      campaigns: Array.from(byCampaign.values())
        .map((c) => ({
          ...c,
          ctr: c.impressions ? (c.clicks / c.impressions) * 100 : 0,
          cpc: c.clicks ? c.spend / c.clicks : 0,
          costPerResult: c.results ? c.spend / c.results : null,
        }))
        .sort((a, b) => b.spend - a.spend),
      lastSyncedAt,
    });
  } catch (err) { next(err); }
}

// ─── AUDIENCE / PLACEMENT / REGION (who's converting, where) ──────────────────

export async function getAudienceInsights(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const connection = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId, platform: 'META_ADS' } });
    if (!connection?.accessTokenEncrypted || !connection.externalPageId) throw new NotFoundError('Ad account not found or disconnected');

    const range = req.query.range === 'today' ? 1 : req.query.range === '30d' ? 30 : 7;
    const campaignFilter = typeof req.query.campaignExternalId === 'string' ? req.query.campaignExternalId : undefined;
    const context = await fetchCampaignContext(connection, range, campaignFilter);
    res.json(context);
  } catch (err) { next(err); }
}

// The prompt below explicitly instructs the model to use the account's real currency code
// instead of "R$" — confirmed live that this instruction isn't reliably followed (two real
// analyses seconds apart, one correctly said "ZAR", the next reverted to "R$" with no code
// change between them — a plain LLM-compliance miss, not a caching or reload issue). Prompting
// alone can't be trusted for something this deterministic, so every reasoning string gets
// rewritten here as a guaranteed backstop regardless of what the model actually wrote.
function sanitizeCurrencyMentions(text: string, currency: string): string {
  if (currency === 'BRL') return text; // "R$"/"BRL" are already correct for a BRL account
  return text.replace(/R\$\s?/g, `${currency} `).replace(/\bBRL\b/g, currency);
}

// ─── AI ANALYSIS + RECOMMENDATIONS ─────────────────────────────────────────────

export async function analyzeAdAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const connection = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId, platform: 'META_ADS' } });
    if (!connection) throw new NotFoundError('Ad account not found');

    // Optional — scopes the analysis to one campaign instead of blending all of the account's
    // campaigns into a single pass. Without this, an account with several campaigns at very
    // different scales (one just launched, one long-running and paused) gets analyzed together,
    // which is harder for the model to reason about clearly and makes "which campaign is this
    // recommendation really about" less obvious in the UI.
    const { campaignExternalId: campaignFilter } = req.body as { campaignExternalId?: string };

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const allRows = await db.adInsightDaily.findMany({ where: { connectionId: connection.id, date: { gte: since } } });
    const rows = campaignFilter ? allRows.filter((r: any) => r.campaignExternalId === campaignFilter) : allRows;
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
    // The account's real currency (e.g. ZAR), not the agency's own — Meta ad accounts are billed
    // in whatever currency was picked when the account was created, which for an international
    // agency won't always match where the agency itself is based. Hardcoding "R$" here made every
    // recommendation's reasoning text claim Brazilian reais regardless of the account's actual
    // currency (confirmed live: a ZAR account's suggestions read "R$ 15,00").
    const currency = connection.metadata ? (JSON.parse(connection.metadata).currency || 'BRL') : 'BRL';

    // Who's converting and where/how — without this the model only ever sees blended totals
    // (spend, clicks, results) and can only really do budget arithmetic. A real media buyer looks
    // at audience/placement/region mix before calling a campaign healthy or not; this is best-
    // effort context (a Meta hiccup here shouldn't block the whole analysis — the model still
    // works fine off just the core numbers, same as before this existed).
    let context: Awaited<ReturnType<typeof fetchCampaignContext>> | null = null;
    try {
      context = await fetchCampaignContext(connection, 7, campaignFilter);
    } catch (err) {
      console.error('[analyzeAdAccount] audience/placement context fetch failed, continuing without it:', err);
    }
    const fmtMoney = (n: number) => `${currency} ${n.toFixed(2)}`;
    const contextBlock = context
      ? `\n\nPúblico que mais converteu (idade · gênero — gasto, resultados):\n${
          context.demographics.map((d) => `- ${d.label} — ${fmtMoney(d.spend)}, ${d.results} resultado(s)`).join('\n') || '(sem dados suficientes)'
        }\n\nPosicionamentos (onde os anúncios apareceram — gasto, resultados):\n${
          context.placements.map((p) => `- ${p.label} — ${fmtMoney(p.spend)}, ${p.results} resultado(s)`).join('\n') || '(sem dados suficientes)'
        }\n\nRegiões (gasto, cliques, contactos iniciados, resultados):\n${
          context.regions.map((r) => `- ${r.label} — ${fmtMoney(r.spend)}, ${r.clicks} cliques, ${r.contacts} contactos, ${r.results} resultado(s)`).join('\n') || '(sem dados suficientes)'
        }${context.frequency != null ? `\n\nFrequência média: ${context.frequency.toFixed(2)} (impressões por pessoa alcançada — acima de ~3-4 costuma indicar fadiga de anúncio no público atual)` : ''}${
          context.reach != null ? `\nAlcance total: ${context.reach.toLocaleString('pt-BR')} pessoas únicas` : ''
        }\nCliques no link: ${context.linkClicks}; contactos iniciados: ${context.contacts}; taxa de contactos por clique: ${context.contactRate != null ? context.contactRate.toFixed(1) + '%' : 'indisponível'}. Contactos são eventos agregados da Meta, não pessoas identificadas.`
      : '';

    const analysis = await ai.generateJSON<{
      recommendations: { campaignExternalId: string; campaignName: string; actionType: string; actionParams?: { newDailyBudgetCents?: number }; reasoning: string }[];
    }>({
      temperature: 0.2,
      maxTokens: 8192,
      systemPrompt: `Você é o melhor gestor de tráfego pago (Meta Ads) da agência — um estrategista sênior, não uma calculadora de orçamento. Você recebe a performance das campanhas dos últimos 7 dias, incluindo QUEM está convertendo (idade/gênero), ONDE os anúncios aparecem (posicionamento) e de QUE REGIÃO — use tudo isso, não só gasto e resultado agregado, para dar um plano de ação que realmente funciona, do jeito que um especialista de verdade analisaria a conta.
Para cada campanha que precisa de atenção, sugira UMA ação clara e específica, com raciocínio tático real — cite o segmento, posicionamento ou região que embasa a decisão sempre que os dados de público estiverem disponíveis, não apenas o número de gasto/resultado da campanha como um todo.
Retorne SOMENTE JSON, sem markdown: { "recommendations": [{ "campaignExternalId": string, "campaignName": string, "actionType": "PAUSE" | "INCREASE_BUDGET" | "DECREASE_BUDGET" | "ADVISORY", "actionParams": {"newDailyBudgetCents": number} (obrigatório só para INCREASE_BUDGET/DECREASE_BUDGET, valor em centavos), "reasoning": string (3-5 frases em português, citando números concretos E, quando disponível, o público/posicionamento/região que sustenta a recomendação) }] }
Use "PAUSE" para campanhas com gasto alto e poucos ou nenhum resultado, sem sinal de que ajustar segmentação resolveria. Use "INCREASE_BUDGET" para campanhas com custo por resultado bom E sinal claro de que ainda há público/posicionamento saudável pra escalar (frequência baixa, sem esgotamento aparente) — no reasoning, aponte especificamente qual segmento/posicionamento justifica escalar. Use "DECREASE_BUDGET" para campanhas gastando acima do razoável pro resultado que entregam, sem justificar pausa total. Use "ADVISORY" sempre que a melhor ação NÃO for orçamento — por exemplo: concentrar o público num segmento de idade/gênero que converte muito mais que a média, restringir ou priorizar um posicionamento específico (ex: parar de gastar em Audience Network se ele não gera resultado, focar em Reels se é onde as conversas realmente acontecem), revisar criativo, ou ajustar segmentação geográfica — seja tático e específico, citando os dados de público que embasam a sugestão, não um conselho genérico de "revisar a campanha". Frequência acima de ~3-4 é sinal de fadiga — considere isso ao decidir entre escalar orçamento vs. trocar criativo/público primeiro. Só recomende campanhas com algo genuinamente acionável — não force uma recomendação por campanha se ela está saudável.
IMPORTANTE: a conta de anúncios usa a moeda ${currency}. Sempre que citar valores monetários no "reasoning", use o código ${currency} (ex: "${currency} 15,00") — NUNCA use "R$" ou qualquer outro símbolo/código de moeda, mesmo que o texto esteja em português.`,
      userPrompt: `Cliente: ${client?.name || 'Cliente'}\nMoeda da conta: ${currency}\nCampanhas (últimos 7 dias):\n${Array.from(byCampaign.entries())
        .map(([id, c]) => `- [${id}] "${c.name}" (status: ${c.status}) — gasto: ${currency} ${c.spend.toFixed(2)}, cliques: ${c.clicks}, impressões: ${c.impressions}, resultados: ${c.results}, custo/resultado: ${c.results ? (c.spend / c.results).toFixed(2) : 'N/A'}`)
        .join('\n')}${contextBlock}`,
    });

    if (!analysis || !Array.isArray(analysis.recommendations)) {
      throw new AIProviderError('A IA não retornou recomendações no formato esperado. Tente analisar uma campanha de cada vez.');
    }

    const created = await Promise.all(
      analysis.recommendations.flatMap((r) => {
        if (!r || typeof r !== 'object') return [];
        const campaign = byCampaign.get(r.campaignExternalId);
        if (!campaign || typeof r.reasoning !== 'string' || !r.reasoning.trim()) return [];
        if (!['PAUSE', 'INCREASE_BUDGET', 'DECREASE_BUDGET', 'ADVISORY'].includes(r.actionType)) return [];

        // A model cannot verify the current budget or Meta's minimum from performance data.
        // Keep budget suggestions reviewable instead of allowing an unverified amount to be applied.
        const budgetAction = r.actionType === 'INCREASE_BUDGET' || r.actionType === 'DECREASE_BUDGET';
        const pauseSupported = campaign.status === 'ACTIVE' && campaign.spend > 0 &&
          campaign.impressions >= 500 && campaign.results === 0;
        const actionType = budgetAction || (r.actionType === 'PAUSE' && !pauseSupported)
          ? 'ADVISORY' : r.actionType;
        const evidence = `Dados verificados (7 dias): ${fmtMoney(campaign.spend)} gastos, ${campaign.impressions} impressões, ${campaign.clicks} cliques e ${campaign.results} resultados.`;
        const caveat = budgetAction ? ' Alteração de orçamento requer conferência do orçamento atual e do mínimo permitido na Meta.' : '';
        return [db.adRecommendation.create({
          data: {
            agencyId: req.user!.agencyId,
            clientId: connection.clientId,
            connectionId: connection.id,
            campaignExternalId: r.campaignExternalId,
            campaignName: campaign.name,
            actionType,
            actionParams: actionType === r.actionType && r.actionParams ? JSON.stringify(r.actionParams) : null,
            reasoning: `${evidence} ${sanitizeCurrencyMentions(r.reasoning, currency)}${caveat}`,
          },
        })];
      })
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

    let applyRes = await fetch(`${GRAPH_URL}/${rec.campaignExternalId}?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let appliedBudgetCents: number | null = null;
    if (!applyRes.ok) {
      const err = await metaApiError(applyRes);
      // The AI has no way to know Meta's actual minimum daily budget for this specific campaign
      // (it depends on the campaign's current delivery, not just the account's currency) — Meta
      // itself only reveals it by rejecting a too-low value, in a message like "...orçamento deve
      // ser de pelo menos ZAR16,00." When that's what happened on a budget change, retry once at
      // Meta's own stated minimum (+5% so a small live fluctuation doesn't bounce it right back)
      // instead of just failing — the agency asked to increase the budget, not to be told a
      // number and have to redo the whole flow manually.
      const isBudgetAction = rec.actionType === 'INCREASE_BUDGET' || rec.actionType === 'DECREASE_BUDGET';
      const minMatch = isBudgetAction ? err.message.match(/pelo menos[^\d]*([\d]+(?:[.,]\d+)?)/i) : null;
      const minCents = minMatch ? Math.round(parseFloat(minMatch[1].replace(',', '.')) * 100) : null;
      if (minCents && minCents > body.daily_budget) {
        const retryBudgetCents = Math.ceil((minCents * 1.05) / 100) * 100;
        applyRes = await fetch(`${GRAPH_URL}/${rec.campaignExternalId}?access_token=${accessToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ daily_budget: retryBudgetCents }),
        });
        if (!applyRes.ok) throw await metaApiError(applyRes);
        appliedBudgetCents = retryBudgetCents;
      } else {
        throw err;
      }
    }

    const updated = await db.adRecommendation.update({
      where: { id: rec.id },
      data: {
        status: 'APPLIED',
        appliedAt: new Date(),
        appliedBy: req.user!.id,
        // Keep the audit trail honest — if Meta's minimum forced a different value than what was
        // recommended, actionParams should reflect what was ACTUALLY applied, not the original ask.
        ...(appliedBudgetCents ? { actionParams: JSON.stringify({ newDailyBudgetCents: appliedBudgetCents }) } : {}),
      },
    });
    res.json({ ...updated, adjustedToMetaMinimum: appliedBudgetCents != null });
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
