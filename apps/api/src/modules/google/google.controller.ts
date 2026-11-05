import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { decrypt, encrypt } from '../../common/crypto';
import { AppError, NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
import {
  GOOGLE_AUTH_URL, exchangeYouTubeCode, refreshYouTubeToken,
  getAgencyYouTubeCredentials, buildYouTubeRedirectUri,
} from '../../integrations/youtube/youtubeClient';
import { resolveAgencyAIProvider } from '../../integrations/ai/ai.provider';

type Kind = 'ads' | 'analytics';
type Option = { id: string; name: string; currency?: string; loginCustomerId?: string };
type Pending = {
  agencyId: string; clientId: string; userId: string; kind: Kind; expiresAt: number;
  accessToken: string; refreshToken: string; expiresIn: number; options: Option[];
};

const ADS_API = 'https://googleads.googleapis.com/v25';
const GA4_ADMIN = 'https://analyticsadmin.googleapis.com/v1beta';
const GA4_DATA = 'https://analyticsdata.googleapis.com/v1beta';
const CALLBACK = '/api/v1/google/callback';
const pendingConnections = new Map<string, Pending>();

function oauthKey() {
  const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) throw new AppError('Configure ENCRYPTION_KEY para conectar o Google.', 500);
  return key;
}

function signedState(value: { agencyId: string; clientId: string; userId: string; kind: Kind; expiresAt: number }) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  const signature = crypto.createHmac('sha256', oauthKey()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function parseState(state: string): { agencyId: string; clientId: string; userId: string; kind: Kind; expiresAt: number } {
  const [payload, supplied] = state.split('.');
  if (!payload || !supplied) throw new ValidationError('Autorização Google inválida.');
  const expected = crypto.createHmac('sha256', oauthKey()).update(payload).digest();
  const signature = Buffer.from(supplied, 'base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) {
    throw new ValidationError('Autorização Google inválida.');
  }
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (!data.agencyId || !data.clientId || !data.userId || !['ads', 'analytics'].includes(data.kind) || data.expiresAt < Date.now()) {
    throw new ValidationError('Autorização Google expirada.');
  }
  return data;
}

async function googleJson(url: string, accessToken: string, init?: RequestInit, loginCustomerId?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (init?.body) headers['Content-Type'] = 'application/json';
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;
  const response = await fetch(url, { ...init, headers: { ...headers, ...init?.headers } });
  const body = await response.json() as any;
  if (!response.ok) {
    const reason = body?.error?.details?.[0]?.errors?.[0]?.errorCode;
    const message = body?.error?.message || 'A API do Google não respondeu.';
    if (JSON.stringify(reason || '').includes('CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION')) {
      throw new AppError('O projeto Google Cloud precisa de acesso de produção à API Google Ads.', 502);
    }
    throw new AppError(`Google: ${String(message).slice(0, 300)}`, 502);
  }
  return body;
}

async function adsSearch(customerId: string, accessToken: string, query: string, loginCustomerId?: string) {
  const data = await googleJson(`${ADS_API}/customers/${customerId}/googleAds:searchStream`, accessToken, {
    method: 'POST', body: JSON.stringify({ query }),
  }, loginCustomerId);
  return (Array.isArray(data) ? data : []).flatMap((batch: any) => batch.results || []);
}

async function discoverAds(accessToken: string): Promise<Option[]> {
  const accessible = await googleJson(`${ADS_API}/customers:listAccessibleCustomers`, accessToken);
  const ids = (accessible.resourceNames || []).map((name: string) => name.replace('customers/', '')).filter((id: string) => /^\d+$/.test(id));
  const found = new Map<string, Option>();
  for (const id of ids) {
    const customers = await adsSearch(id, accessToken,
      'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1');
    const customer = customers[0]?.customer;
    if (!customer?.manager) {
      found.set(id, { id, name: customer?.descriptiveName || `Google Ads ${id}`, currency: customer?.currencyCode });
      continue;
    }
    // A manager account can access several clients; show only leaf accounts with reporting data.
    const children = await adsSearch(id, accessToken,
      'SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager FROM customer_client WHERE customer_client.level > 0 AND customer_client.manager = FALSE');
    for (const row of children) {
      const child = row.customerClient;
      if (!child?.id) continue;
      found.set(String(child.id), {
        id: String(child.id), name: child.descriptiveName || `Google Ads ${child.id}`,
        currency: child.currencyCode, loginCustomerId: id,
      });
    }
  }
  return [...found.values()];
}

async function discoverProperties(accessToken: string): Promise<Option[]> {
  const options: Option[] = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '200' });
    if (pageToken) query.set('pageToken', pageToken);
    const data = await googleJson(`${GA4_ADMIN}/accountSummaries?${query}`, accessToken);
    for (const account of data.accountSummaries || []) {
      for (const property of account.propertySummaries || []) {
        const id = String(property.property || '').replace('properties/', '');
        if (/^\d+$/.test(id)) options.push({ id, name: `${property.displayName || id} · ${account.displayName || 'GA4'}` });
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return options;
}

function cleanupPending() {
  for (const [key, value] of pendingConnections) if (value.expiresAt < Date.now()) pendingConnections.delete(key);
}

export async function settings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const credentials = await getAgencyYouTubeCredentials(req.user!.agencyId);
    res.json({ configured: !!credentials, clientId: credentials?.clientId || null,
      callbackUrl: buildYouTubeRedirectUri(CALLBACK) });
  } catch (error) { next(error); }
}

export async function connect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const kind = req.query.kind;
    if (kind !== 'ads' && kind !== 'analytics') throw new ValidationError('Escolha Google Ads ou Analytics.');
    const clientId = String(req.query.clientId || '');
    const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: req.user!.agencyId } });
    if (!client) throw new NotFoundError('Cliente não encontrado.');
    const credentials = await getAgencyYouTubeCredentials(req.user!.agencyId);
    if (!credentials) throw new ValidationError('Configure o Client ID e Secret do Google em Redes Sociais > Agência > YouTube.');
    const state = signedState({ agencyId: req.user!.agencyId, clientId, userId: req.user!.id, kind, expiresAt: Date.now() + 10 * 60 * 1000 });
    const scope = kind === 'ads' ? 'https://www.googleapis.com/auth/adwords' : 'https://www.googleapis.com/auth/analytics.readonly';
    const authUrl = `${GOOGLE_AUTH_URL}?${new URLSearchParams({
      client_id: credentials.clientId, redirect_uri: buildYouTubeRedirectUri(CALLBACK), response_type: 'code',
      scope, access_type: 'offline', prompt: 'consent', state,
    })}`;
    res.json({ authUrl });
  } catch (error) { next(error); }
}

export async function callback(req: Request, res: Response) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    if (req.query.error || !req.query.code || !req.query.state) throw new ValidationError('Autorização Google cancelada.');
    const state = parseState(String(req.query.state));
    const client = await prisma.client.findFirst({ where: { id: state.clientId, agencyId: state.agencyId } });
    if (!client) throw new NotFoundError('Cliente não encontrado.');
    const credentials = await getAgencyYouTubeCredentials(state.agencyId);
    if (!credentials) throw new ValidationError('Credenciais Google não configuradas.');
    const token = await exchangeYouTubeCode(credentials, String(req.query.code), buildYouTubeRedirectUri(CALLBACK));
    const options = state.kind === 'ads'
      ? await discoverAds(token.accessToken)
      : await discoverProperties(token.accessToken);
    if (!options.length) throw new ValidationError('Nenhuma conta acessível encontrada. Verifique as permissões no Google.');
    cleanupPending();
    const pendingToken = crypto.randomBytes(32).toString('base64url');
    pendingConnections.set(pendingToken, { ...state, expiresAt: Date.now() + 10 * 60 * 1000,
      accessToken: token.accessToken, refreshToken: token.refreshToken, expiresIn: token.expiresIn, options });
    res.redirect(`${appUrl}/app/google?google_pending=${pendingToken}`);
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    res.redirect(`${appUrl}/app/google?google_error=1`);
  }
}

export async function pending(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    cleanupPending();
    const item = pendingConnections.get(req.params.token);
    if (!item || item.agencyId !== req.user!.agencyId || item.userId !== req.user!.id) throw new NotFoundError('Seleção expirada. Conecte novamente.');
    res.json({ clientId: item.clientId, kind: item.kind, options: item.options });
  } catch (error) { next(error); }
}

export async function confirm(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    cleanupPending();
    const item = pendingConnections.get(req.params.token);
    if (!item || item.agencyId !== req.user!.agencyId || item.userId !== req.user!.id) throw new NotFoundError('Seleção expirada. Conecte novamente.');
    const selected = item.options.find(option => option.id === req.body.optionId);
    if (!selected) throw new ValidationError('Selecione uma conta disponível.');
    const platform = item.kind === 'ads' ? 'GOOGLE_ADS' : 'GOOGLE_ANALYTICS';
    const where = { agencyId: item.agencyId, clientId: item.clientId, platform, externalPageId: selected.id };
    const existing = await prisma.socialConnection.findFirst({ where });
    const data = { accountName: selected.name, accessTokenEncrypted: encrypt(item.accessToken),
      refreshTokenEncrypted: encrypt(item.refreshToken), tokenExpiresAt: new Date(Date.now() + item.expiresIn * 1000),
      scopes: JSON.stringify([item.kind === 'ads' ? 'https://www.googleapis.com/auth/adwords' : 'https://www.googleapis.com/auth/analytics.readonly']),
      metadata: JSON.stringify({ currency: selected.currency, loginCustomerId: selected.loginCustomerId }),
      status: 'ACTIVE', connectedBy: item.userId };
    const connection = existing
      ? await prisma.socialConnection.update({ where: { id: existing.id }, data })
      : await prisma.socialConnection.create({ data: { ...where, ...data } });
    pendingConnections.delete(req.params.token);
    res.json({ id: connection.id });
  } catch (error) { next(error); }
}

export async function connections(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clientId = String(req.query.clientId || '');
    const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: req.user!.agencyId } });
    if (!client) throw new NotFoundError('Cliente não encontrado.');
    const rows = await prisma.socialConnection.findMany({ where: { agencyId: req.user!.agencyId, clientId,
      platform: { in: ['GOOGLE_ADS', 'GOOGLE_ANALYTICS'] } }, orderBy: { createdAt: 'desc' } });
    res.json(rows.map(row => ({ id: row.id, kind: row.platform === 'GOOGLE_ADS' ? 'ads' : 'analytics',
      name: row.accountName, externalId: row.externalPageId, status: row.status, connectedAt: row.createdAt,
      currency: row.metadata ? JSON.parse(row.metadata).currency || null : null })));
  } catch (error) { next(error); }
}

export async function disconnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId,
      platform: { in: ['GOOGLE_ADS', 'GOOGLE_ANALYTICS'] } } });
    if (!row) throw new NotFoundError('Conexão não encontrada.');
    await prisma.socialConnection.delete({ where: { id: row.id } });
    res.status(204).send();
  } catch (error) { next(error); }
}

async function accessTokenFor(row: { id: string; agencyId: string; accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null; tokenExpiresAt: Date | null }) {
  if (row.accessTokenEncrypted && row.tokenExpiresAt && row.tokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return decrypt(row.accessTokenEncrypted);
  }
  if (!row.refreshTokenEncrypted) throw new ValidationError('A conexão Google expirou. Conecte novamente.');
  const credentials = await getAgencyYouTubeCredentials(row.agencyId);
  if (!credentials) throw new ValidationError('Configure novamente o Google OAuth da agência.');
  const fresh = await refreshYouTubeToken(credentials, decrypt(row.refreshTokenEncrypted));
  await prisma.socialConnection.update({ where: { id: row.id }, data: {
    accessTokenEncrypted: encrypt(fresh.accessToken), tokenExpiresAt: new Date(Date.now() + fresh.expiresIn * 1000),
  } });
  return fresh.accessToken;
}

function rangeValue(value: unknown) {
  if (value === 'today') return 'today';
  if (value === '30d') return '30d';
  return '7d';
}

function metric(row: any, index: number) { return Number(row?.metricValues?.[index]?.value || 0); }

async function analyticsInsights(propertyId: string, accessToken: string, range: string) {
  const dateRanges = [{ startDate: range === 'today' ? 'today' : range === '30d' ? '29daysAgo' : '6daysAgo', endDate: 'today' }];
  const run = (dimensions: string[], metrics: string[], limit: number) => googleJson(`${GA4_DATA}/properties/${propertyId}:runReport`, accessToken, {
    method: 'POST', body: JSON.stringify({ dateRanges, dimensions: dimensions.map(name => ({ name })), metrics: metrics.map(name => ({ name })), limit,
      dimensionFilter: { filter: { fieldName: 'platform', stringFilter: { matchType: 'EXACT', value: 'web' } } },
      orderBys: [{ metric: { metricName: metrics[0] }, desc: true }] }),
  });
  const [summary, pages, channels, countries] = await Promise.all([
    run([], ['activeUsers', 'sessions', 'screenPageViews', 'engagedSessions', 'engagementRate', 'keyEvents'], 1),
    run(['pagePath'], ['screenPageViews', 'activeUsers'], 10),
    run(['sessionDefaultChannelGroup'], ['sessions', 'keyEvents'], 10),
    run(['country'], ['sessions', 'activeUsers'], 10),
  ]);
  const total = summary.rows?.[0];
  return { kind: 'analytics' as const, range, totals: { users: metric(total, 0), sessions: metric(total, 1),
    views: metric(total, 2), engagedSessions: metric(total, 3), engagementRate: metric(total, 4), keyEvents: metric(total, 5) },
    pages: (pages.rows || []).map((row: any) => ({ label: row.dimensionValues?.[0]?.value || '/', views: metric(row, 0), users: metric(row, 1) })),
    channels: (channels.rows || []).map((row: any) => ({ label: row.dimensionValues?.[0]?.value || 'Outros', sessions: metric(row, 0), keyEvents: metric(row, 1) })),
    countries: (countries.rows || []).map((row: any) => ({ label: row.dimensionValues?.[0]?.value || 'Desconhecido', sessions: metric(row, 0), users: metric(row, 1) })),
  };
}

async function adsInsights(customerId: string, accessToken: string, range: string, metadata: any) {
  const during = range === 'today' ? 'TODAY' : range === '30d' ? 'LAST_30_DAYS' : 'LAST_7_DAYS';
  const rows = await adsSearch(customerId, accessToken,
    `SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr FROM campaign WHERE segments.date DURING ${during} AND campaign.status != REMOVED`,
    metadata.loginCustomerId);
  const campaigns = rows.map((row: any) => ({ id: String(row.campaign?.id || ''), name: row.campaign?.name || 'Campanha',
    status: row.campaign?.status || '', impressions: Number(row.metrics?.impressions || 0), clicks: Number(row.metrics?.clicks || 0),
    spend: Number(row.metrics?.costMicros || 0) / 1_000_000, conversions: Number(row.metrics?.conversions || 0),
    ctr: Number(row.metrics?.ctr || 0) }));
  const totals = campaigns.reduce((acc: any, campaign: any) => ({ impressions: acc.impressions + campaign.impressions,
    clicks: acc.clicks + campaign.clicks, spend: acc.spend + campaign.spend, conversions: acc.conversions + campaign.conversions }),
  { impressions: 0, clicks: 0, spend: 0, conversions: 0 });
  return { kind: 'ads' as const, range, currency: metadata.currency || 'USD',
    totals: { ...totals, ctr: totals.impressions ? 100 * totals.clicks / totals.impressions : 0,
      cpc: totals.clicks ? totals.spend / totals.clicks : 0,
      costPerConversion: totals.conversions ? totals.spend / totals.conversions : 0 }, campaigns };
}

// Shared read-only reporting for the agency Performance page. The explicit date range
// includes today for every Google source, matching the other cards on that page.
export async function getGooglePerformanceInsights(connection: {
  id: string; agencyId: string; platform: string; externalPageId: string | null;
  accessTokenEncrypted: string | null; refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null; metadata: string | null;
}, days: number) {
  if (!connection.externalPageId) throw new ValidationError('Conta Google sem identificador. Conecte novamente.');
  const token = await accessTokenFor(connection);
  const startDate = days === 1 ? 'today' : `${days - 1}daysAgo`;
  const dateRanges = [{ startDate, endDate: 'today' }];
  if (connection.platform === 'GOOGLE_ANALYTICS') {
    const run = (dimensions: string[], metrics: string[], limit: number) => googleJson(
      `${GA4_DATA}/properties/${connection.externalPageId}:runReport`, token,
      { method: 'POST', body: JSON.stringify({
        dateRanges, dimensions: dimensions.map(name => ({ name })), metrics: metrics.map(name => ({ name })), limit,
        dimensionFilter: { filter: { fieldName: 'platform', stringFilter: { matchType: 'EXACT', value: 'web' } } },
      }) },
    );
    const [summary, channels, daily] = await Promise.all([
      run([], ['activeUsers', 'sessions', 'screenPageViews', 'keyEvents'], 1),
      run(['sessionDefaultChannelGroup'], ['sessions'], 20),
      run(['date'], ['sessions', 'screenPageViews'], 100),
    ]);
    const total = summary.rows?.[0];
    return { kind: 'analytics' as const, connectionId: connection.id,
      totals: { users: metric(total, 0), sessions: metric(total, 1), views: metric(total, 2), keyEvents: metric(total, 3) },
      channels: (channels.rows || []).map((row: any) => ({ label: row.dimensionValues?.[0]?.value || 'Outros', sessions: metric(row, 0) })),
      daily: (daily.rows || []).map((row: any) => {
        const raw = row.dimensionValues?.[0]?.value || '';
        return { date: /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}` : raw,
          sessions: metric(row, 0), views: metric(row, 1) };
      }),
    };
  }
  const metadata = connection.metadata ? JSON.parse(connection.metadata) : {};
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const rows = await adsSearch(connection.externalPageId, token,
    `SELECT customer.id, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date BETWEEN '${iso(start)}' AND '${iso(end)}'`,
    metadata.loginCustomerId);
  const daily = new Map<string, { date: string; impressions: number; clicks: number; spend: number; conversions: number }>();
  for (const row of rows) {
    const date = String(row.segments?.date || '');
    if (!date) continue;
    const day = daily.get(date) || { date, impressions: 0, clicks: 0, spend: 0, conversions: 0 };
    day.impressions += Number(row.metrics?.impressions || 0);
    day.clicks += Number(row.metrics?.clicks || 0);
    day.spend += Number(row.metrics?.costMicros || 0) / 1_000_000;
    day.conversions += Number(row.metrics?.conversions || 0);
    daily.set(date, day);
  }
  const totals = [...daily.values()].reduce((sum, row) => ({
    impressions: sum.impressions + row.impressions, clicks: sum.clicks + row.clicks,
    spend: sum.spend + row.spend, conversions: sum.conversions + row.conversions,
  }), { impressions: 0, clicks: 0, spend: 0, conversions: 0 });
  return { kind: 'ads' as const, connectionId: connection.id, currency: metadata.currency || null,
    totals, daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export async function insights(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId,
      platform: { in: ['GOOGLE_ADS', 'GOOGLE_ANALYTICS'] } } });
    if (!row || !row.externalPageId) throw new NotFoundError('Conexão não encontrada.');
    const token = await accessTokenFor(row);
    const range = rangeValue(req.query.range);
    const result = row.platform === 'GOOGLE_ADS'
      ? await adsInsights(row.externalPageId, token, range, row.metadata ? JSON.parse(row.metadata) : {})
      : await analyticsInsights(row.externalPageId, token, range);
    res.json(result);
  } catch (error) { next(error); }
}

export async function analyze(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId,
      platform: { in: ['GOOGLE_ADS', 'GOOGLE_ANALYTICS'] } } });
    if (!row?.externalPageId) throw new NotFoundError('Conexão não encontrada.');
    const token = await accessTokenFor(row);
    const range = rangeValue(req.body?.range);
    const report = row.platform === 'GOOGLE_ADS'
      ? await adsInsights(row.externalPageId, token, range, row.metadata ? JSON.parse(row.metadata) : {})
      : await analyticsInsights(row.externalPageId, token, range);
    const targets = report.kind === 'ads'
      ? report.campaigns.map((campaign: any) => ({ id: campaign.id, name: campaign.name,
        evidence: `${campaign.impressions} impressões, ${campaign.clicks} cliques, ${campaign.conversions} conversões, ${report.currency} ${campaign.spend.toFixed(2)} gastos.` }))
      : [
        ...report.pages.map((page: any) => ({ id: `page:${page.label}`, name: page.label, evidence: `${page.views} visualizações, ${page.users} utilizadores.` })),
        ...report.channels.map((channel: any) => ({ id: `channel:${channel.label}`, name: channel.label, evidence: `${channel.sessions} sessões, ${channel.keyEvents} eventos principais.` })),
      ];
    if (!targets.length) throw new ValidationError('Ainda não há dados suficientes para analisar neste período.');
    const ai = await resolveAgencyAIProvider(req.user!.agencyId, 'text');
    const result = await ai.generateJSON<{ recommendations: Array<{ targetId: string; action: string; reasoning: string }> }>({
      temperature: 0.2, maxTokens: 4096,
      systemPrompt: `Você é um gestor de tráfego e analista digital. Analise exclusivamente os dados JSON fornecidos, sem inventar números, ROAS, metas, eventos de contacto ou causas não medidas. Responda em português com JSON válido: {"recommendations":[{"targetId":"id exato do alvo fornecido","action":"ação prática e específica","reasoning":"razão breve baseada nos dados"}]}. No máximo 5 recomendações. Só recomende mudanças fundamentadas nos dados observados. Se os dados não bastarem para uma decisão, proponha investigar o motivo, sem afirmar causalidade. Não proponha alteração automática de orçamento ou de campanhas.`,
      userPrompt: JSON.stringify({ platform: report.kind, range, totals: report.totals, targets: targets.slice(0, 40),
        ...(report.kind === 'analytics' ? { countries: report.countries } : {}) }),
    });
    const validated = Array.isArray(result?.recommendations) ? result.recommendations.flatMap(item => {
      const target = targets.find((candidate: any) => candidate.id === item?.targetId);
      if (!target || typeof item.action !== 'string' || typeof item.reasoning !== 'string'
        || !item.action.trim() || !item.reasoning.trim()) return [];
      return [{ targetId: target.id, targetName: target.name, action: item.action.trim().slice(0, 160),
        reasoning: item.reasoning.trim().slice(0, 700), evidence: target.evidence }];
    }).slice(0, 5) : [];
    res.json({ range, recommendations: validated });
  } catch (error) { next(error); }
}

export async function campaignStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await prisma.socialConnection.findFirst({ where: { id: req.params.id,
      agencyId: req.user!.agencyId, platform: 'GOOGLE_ADS' } });
    if (!row?.externalPageId) throw new NotFoundError('Conta Google Ads não encontrada.');
    const campaignId = req.params.campaignId;
    if (!/^\d+$/.test(campaignId)) throw new ValidationError('Campanha inválida.');
    const status = req.body?.status;
    if (status !== 'PAUSED' && status !== 'ENABLED') throw new ValidationError('Status inválido.');
    const token = await accessTokenFor(row);
    const metadata = row.metadata ? JSON.parse(row.metadata) : {};
    const current = await adsSearch(row.externalPageId, token,
      `SELECT campaign.id, campaign.status FROM campaign WHERE campaign.id = ${campaignId} LIMIT 1`, metadata.loginCustomerId);
    const previous = current[0]?.campaign?.status;
    if (!previous || previous === 'REMOVED') throw new NotFoundError('Campanha não encontrada nesta conta.');
    if (previous === status) return res.json({ id: campaignId, status });
    await googleJson(`${ADS_API}/customers/${row.externalPageId}/campaigns:mutate`, token, {
      method: 'POST', body: JSON.stringify({ operations: [{ updateMask: 'status', update: {
        resourceName: `customers/${row.externalPageId}/campaigns/${campaignId}`, status,
      } }] }),
    }, metadata.loginCustomerId);
    res.json({ id: campaignId, status });
  } catch (error) { next(error); }
}
