import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { encrypt, decrypt } from '../../common/crypto';
import { AppError, NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
import { getAgencyLinkedInCredentials } from '../../integrations/linkedin/linkedinClient';
import { getTikTokAdsCredentials } from '../../integrations/agencyIntegrations';

type Platform = 'tiktok' | 'linkedin';
type Option = { id: string; name: string; currency: string | null };
type Pending = { agencyId: string; clientId: string; userId: string; platform: Platform;
  token: string; tokenExpiresAt: Date | null; options: Option[]; expiresAt: number };

const TT_API = 'https://business-api.tiktok.com/open_api/v1.3';
const LI_API = 'https://api.linkedin.com/rest';
const LI_AUTH = 'https://www.linkedin.com/oauth/v2';
const LI_VERSION = process.env.LINKEDIN_ADS_API_VERSION || '202608';
const pending = new Map<string, Pending>();
const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const callbackUrl = (platform: Platform) => `${appUrl()}/api/v1/ad-platforms/${platform}/callback`;
const pageUrl = (platform: Platform) => `${appUrl()}/app/${platform}-ads`;
const dbPlatform = (platform: Platform) => platform === 'tiktok' ? 'TIKTOK_ADS' : 'LINKEDIN_ADS';
const parsePlatform = (value: string): Platform => {
  if (value !== 'tiktok' && value !== 'linkedin') throw new ValidationError('Plataforma de anúncios inválida.');
  return value;
};
const safeNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

function secret() {
  const value = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!value) throw new AppError('Configure ENCRYPTION_KEY para conectar anúncios.', 500);
  return value;
}
function signState(data: { agencyId: string; clientId: string; userId: string; platform: Platform; expiresAt: number }) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function readState(value: string) {
  const [payload, supplied] = value.split('.');
  if (!payload || !supplied) throw new ValidationError('Autorização expirada ou inválida.');
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest();
  const actual = Buffer.from(supplied, 'base64url');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw new ValidationError('Autorização inválida.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
    agencyId: string; clientId: string; userId: string; platform: Platform; expiresAt: number;
  };
  if (!data.agencyId || !data.clientId || !data.userId || !['tiktok', 'linkedin'].includes(data.platform) || data.expiresAt < Date.now()) {
    throw new ValidationError('Autorização expirada.');
  }
  return data;
}
async function credentials(platform: Platform, agencyId: string) {
  // Configured per agency in Redes sociais › Agência; server env is only the developer fallback.
  if (platform === 'tiktok') return getTikTokAdsCredentials(agencyId);
  const agency = await getAgencyLinkedInCredentials(agencyId);
  if (agency) return { id: agency.clientId, secret: agency.clientSecret };
  const id = process.env.LINKEDIN_ADS_CLIENT_ID;
  const secret = process.env.LINKEDIN_ADS_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

async function tikTokJson(path: string, token?: string, init?: RequestInit) {
  const response = await fetch(`${TT_API}${path}`, { ...init,
    headers: { ...(token ? { 'Access-Token': token } : {}), ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json() as any;
  if (!response.ok || Number(body.code) !== 0) throw new AppError(`TikTok Ads: ${String(body.message || 'A API não respondeu.').slice(0, 220)}`, 502);
  return body.data;
}
async function linkedInJson(path: string, token: string) {
  const response = await fetch(`${LI_API}${path}`, { headers: {
    Authorization: `Bearer ${token}`, 'LinkedIn-Version': LI_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  }, signal: AbortSignal.timeout(30000) });
  const body = await response.json() as any;
  if (!response.ok) throw new AppError(`LinkedIn Ads: ${String(body.message || 'A API não respondeu.').slice(0, 220)}`, 502);
  return body;
}

async function discoverTikTok(token: string, app: { id: string; secret: string }): Promise<Option[]> {
  const query = new URLSearchParams({ app_id: app.id, secret: app.secret });
  const authorized = await tikTokJson(`/oauth2/advertiser/get/?${query}`, token);
  const ids: string[] = [...new Set<string>((Array.isArray(authorized?.list) ? authorized.list : authorized?.advertiser_ids || [])
    .map((item: any) => String(typeof item === 'object' ? item.advertiser_id || item.id : item))
    .filter((id: string) => /^\d+$/.test(id)))];
  if (!ids.length) return [];
  const byId = new Map<string, any>();
  try {
    const details = await tikTokJson(`/advertiser/info/?${new URLSearchParams({ advertiser_ids: JSON.stringify(ids) })}`, token);
    for (const item of details?.list || []) byId.set(String(item.advertiser_id), item);
  } catch { /* The authorized advertiser IDs remain selectable if details are restricted. */ }
  return ids.map(id => ({ id, name: byId.get(id)?.name || byId.get(id)?.advertiser_name || `TikTok Ads ${id}`,
    currency: byId.get(id)?.currency || null }));
}

async function discoverLinkedIn(token: string): Promise<Option[]> {
  const accounts = new Set<string>();
  let pageToken = '';
  for (let page = 0; page < 100; page++) {
    const params = new URLSearchParams({ q: 'authenticatedUser', pageSize: '100' });
    if (pageToken) params.set('pageToken', pageToken);
    const result = await linkedInJson(`/adAccountUsers?${params}`, token);
    for (const row of result.elements || []) {
      const id = String(row.account || '').match(/^urn:li:sponsoredAccount:(\d+)$/)?.[1];
      if (id) accounts.add(id);
    }
    pageToken = result.metadata?.nextPageToken || '';
    if (!pageToken) break;
    if (page === 99) throw new AppError('A lista de contas LinkedIn excede o limite de paginação.', 502);
  }
  const options: Option[] = [];
  for (const id of accounts) {
    const account = await linkedInJson(`/adAccounts/${id}`, token);
    options.push({ id, name: account.name || `LinkedIn Ads ${id}`, currency: account.currency || null });
  }
  return options;
}

export async function settings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const platform = parsePlatform(req.params.platform);
    const configured = !!await credentials(platform, req.user!.agencyId);
    res.json({ configured, callbackUrl: callbackUrl(platform),
      setup: platform === 'tiktok' ? 'Configure o App ID e o Secret do TikTok Ads em Redes sociais › Agência' :
        'Configure a aplicação LinkedIn em Redes sociais › Agência',
      requiredAccess: platform === 'tiktok' ? 'TikTok for Business: Read Ad Account Information e Reporting' :
        'LinkedIn Advertising API aprovada, com r_ads e r_ads_reporting',
    });
  } catch (error) { next(error); }
}

export async function connect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const platform = parsePlatform(req.params.platform);
    const clientId = String(req.query.clientId || '');
    const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: req.user!.agencyId, deletedAt: null } });
    if (!client) throw new NotFoundError('Cliente não encontrado.');
    const app = await credentials(platform, req.user!.agencyId);
    if (!app) throw new ValidationError(`Configure a aplicação ${platform === 'tiktok' ? 'TikTok for Business' : 'LinkedIn'} primeiro.`);
    const state = signState({ agencyId: req.user!.agencyId, clientId, userId: req.user!.id,
      platform, expiresAt: Date.now() + 10 * 60 * 1000 });
    const url = platform === 'tiktok'
      ? `https://ads.tiktok.com/marketing_api/auth?${new URLSearchParams({ app_id: app.id, redirect_uri: callbackUrl(platform), state })}`
      : `${LI_AUTH}/authorization?${new URLSearchParams({ response_type: 'code', client_id: app.id,
        redirect_uri: callbackUrl(platform), state, scope: 'r_ads r_ads_reporting' })}`;
    res.json({ authUrl: url });
  } catch (error) { next(error); }
}

export async function callback(req: Request, res: Response) {
  let platform: Platform = 'tiktok';
  try {
    platform = parsePlatform(req.params.platform);
    const state = readState(String(req.query.state || ''));
    if (state.platform !== platform || req.query.error) throw new ValidationError('Autorização recusada ou inválida.');
    const code = String(platform === 'tiktok' ? req.query.auth_code || '' : req.query.code || '');
    if (!code) throw new ValidationError('A plataforma não retornou um código de autorização.');
    const app = await credentials(platform, state.agencyId);
    if (!app) throw new ValidationError('Aplicação de anúncios não configurada.');
    let token: string;
    let tokenExpiresAt: Date | null = null;
    let options: Option[];
    if (platform === 'tiktok') {
      const data = await tikTokJson('/oauth2/access_token/', undefined, { method: 'POST',
        body: JSON.stringify({ app_id: app.id, secret: app.secret, auth_code: code }) });
      token = String(data?.access_token || '');
      if (!token) throw new ValidationError('TikTok não retornou um token válido.');
      if (data.expires_in) tokenExpiresAt = new Date(Date.now() + Number(data.expires_in) * 1000);
      options = await discoverTikTok(token, app);
    } else {
      const response = await fetch(`${LI_AUTH}/accessToken`, { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code,
          redirect_uri: callbackUrl(platform), client_id: app.id, client_secret: app.secret }),
        signal: AbortSignal.timeout(30000),
      });
      const body = await response.json() as any;
      if (!response.ok) throw new AppError(`LinkedIn: ${String(body.error_description || body.error || 'OAuth falhou').slice(0, 220)}`, 502);
      token = String(body.access_token || '');
      if (!token) throw new ValidationError('LinkedIn não retornou um token válido.');
      if (body.expires_in) tokenExpiresAt = new Date(Date.now() + Number(body.expires_in) * 1000);
      options = await discoverLinkedIn(token);
    }
    if (!options.length) throw new ValidationError('Nenhuma conta de anúncios autorizada foi encontrada.');
    for (const [key, value] of pending) if (value.expiresAt < Date.now()) pending.delete(key);
    const selectionToken = crypto.randomBytes(24).toString('base64url');
    pending.set(selectionToken, { agencyId: state.agencyId, clientId: state.clientId, userId: state.userId,
      platform, token, tokenExpiresAt, options, expiresAt: Date.now() + 10 * 60 * 1000 });
    res.redirect(`${pageUrl(platform)}?ads_pending=${selectionToken}`);
  } catch {
    res.redirect(`${pageUrl(platform)}?ads_error=1`);
  }
}

function pendingFor(req: AuthRequest) {
  const item = pending.get(req.params.token);
  if (!item || item.platform !== parsePlatform(req.params.platform) || item.expiresAt < Date.now() ||
    item.agencyId !== req.user!.agencyId || item.userId !== req.user!.id) {
    throw new NotFoundError('Seleção expirada. Conecte novamente.');
  }
  return item;
}
export async function pendingOptions(req: AuthRequest, res: Response, next: NextFunction) {
  try { const item = pendingFor(req); res.json({ clientId: item.clientId, platform: item.platform, options: item.options }); }
  catch (error) { next(error); }
}
export async function confirm(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const item = pendingFor(req);
    const option = item.options.find(account => account.id === req.body.optionId);
    if (!option) throw new ValidationError('Selecione uma conta autorizada.');
    const client = await prisma.client.findFirst({ where: { id: item.clientId, agencyId: item.agencyId, deletedAt: null } });
    if (!client) throw new NotFoundError('Cliente não encontrado.');
    const where = { agencyId: item.agencyId, clientId: item.clientId,
      platform: dbPlatform(item.platform), externalPageId: option.id };
    const existing = await prisma.socialConnection.findFirst({ where });
    const data = { accountName: option.name, accessTokenEncrypted: encrypt(item.token),
      tokenExpiresAt: item.tokenExpiresAt, metadata: JSON.stringify({ currency: option.currency }),
      status: 'ACTIVE', connectedBy: item.userId };
    const connection = existing
      ? await prisma.socialConnection.update({ where: { id: existing.id }, data })
      : await prisma.socialConnection.create({ data: { ...where, ...data } });
    pending.delete(req.params.token);
    res.json({ id: connection.id, clientId: connection.clientId });
  } catch (error) { next(error); }
}

export async function connections(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const platform = parsePlatform(req.params.platform);
    const clientId = String(req.query.clientId || '');
    const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: req.user!.agencyId, deletedAt: null } });
    if (!client) throw new NotFoundError('Cliente não encontrado.');
    const rows = await prisma.socialConnection.findMany({ where: { agencyId: req.user!.agencyId,
      clientId, platform: dbPlatform(platform) }, orderBy: { createdAt: 'desc' } });
    res.json(rows.map(row => ({ id: row.id, name: row.accountName, externalId: row.externalPageId,
      status: row.status, currency: row.metadata ? JSON.parse(row.metadata).currency || null : null })));
  } catch (error) { next(error); }
}
export async function disconnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const platform = parsePlatform(req.params.platform);
    const row = await prisma.socialConnection.findFirst({ where: { id: req.params.id,
      agencyId: req.user!.agencyId, platform: dbPlatform(platform) } });
    if (!row) throw new NotFoundError('Conta não encontrada.');
    await prisma.socialConnection.delete({ where: { id: row.id } });
    res.status(204).send();
  } catch (error) { next(error); }
}

function dateRange(range: string) {
  const days = range === 'today' ? 1 : range === '90d' ? 90 : range === '30d' ? 30 : 7;
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}
async function tikTokInsights(accountId: string, token: string, range: string) {
  const dates = dateRange(range);
  const rows: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const query = new URLSearchParams({ advertiser_id: accountId, report_type: 'BASIC',
      data_level: 'AUCTION_CAMPAIGN', dimensions: JSON.stringify(['campaign_id']),
      metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'conversion']),
      start_date: dates.start, end_date: dates.end, page: String(page), page_size: '1000' });
    const data = await tikTokJson(`/report/integrated/get/?${query}`, token);
    rows.push(...(data?.list || []));
    if (!data?.page_info || page >= Number(data.page_info.total_page || 1)) break;
    if (page === 20) throw new AppError('O relatório TikTok excede o limite de paginação.', 502);
  }
  const totals = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
  const campaigns = rows.map(row => {
    const metrics = row.metrics || {};
    const campaign = { id: String(row.dimensions?.campaign_id || ''), name: '', status: '',
      spend: safeNumber(metrics.spend), impressions: safeNumber(metrics.impressions),
      clicks: safeNumber(metrics.clicks), conversions: safeNumber(metrics.conversion) };
    totals.spend += campaign.spend; totals.impressions += campaign.impressions;
    totals.clicks += campaign.clicks; totals.conversions += campaign.conversions;
    return campaign;
  });
  // Names and current status are optional context: reporting still works if campaign-read
  // permission has not been approved for the TikTok for Business app.
  try {
    const names = new Map<string, any>();
    for (let page = 1; page <= 5; page++) {
      const query = new URLSearchParams({ advertiser_id: accountId, page: String(page), page_size: '100' });
      const data = await tikTokJson(`/campaign/get/?${query}`, token);
      for (const item of data?.list || []) names.set(String(item.campaign_id), item);
      if (!data?.page_info || page >= Number(data.page_info.total_page || 1)) break;
    }
    for (const campaign of campaigns) {
      campaign.name = names.get(campaign.id)?.campaign_name || `Campanha ${campaign.id}`;
      campaign.status = names.get(campaign.id)?.operation_status || '';
    }
  } catch { for (const campaign of campaigns) campaign.name = `Campanha ${campaign.id}`; }
  return { totals: { ...totals, ctr: totals.impressions ? totals.clicks / totals.impressions * 100 : 0,
    cpc: totals.clicks ? totals.spend / totals.clicks : 0 }, campaigns };
}
async function linkedInInsights(accountId: string, token: string, range: string) {
  const dates = dateRange(range);
  const part = (value: string) => { const [year, month, day] = value.split('-').map(Number);
    return `(year:${year},month:${month},day:${day})`; };
  const base = new URLSearchParams({ q: 'analytics', timeGranularity: 'ALL',
    dateRange: `(start:${part(dates.start)},end:${part(dates.end)})`,
    accounts: `List(urn:li:sponsoredAccount:${accountId})`,
    fields: 'impressions,clicks,costInLocalCurrency,externalWebsiteConversions,pivotValues' });
  const accountQuery = new URLSearchParams(base); accountQuery.set('pivot', 'ACCOUNT');
  const campaignQuery = new URLSearchParams(base); campaignQuery.set('pivot', 'CAMPAIGN');
  const [account, detail] = await Promise.all([
    linkedInJson(`/adAnalytics?${accountQuery}`, token), linkedInJson(`/adAnalytics?${campaignQuery}`, token),
  ]);
  const totals = (account.elements || []).reduce((sum: any, row: any) => ({
    spend: sum.spend + safeNumber(row.costInLocalCurrency), impressions: sum.impressions + safeNumber(row.impressions),
    clicks: sum.clicks + safeNumber(row.clicks), conversions: sum.conversions + safeNumber(row.externalWebsiteConversions),
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
  const campaigns = (detail.elements || []).map((row: any) => {
    const id = String(row.pivotValues?.[0] || '').match(/sponsoredCampaign:(\d+)$/)?.[1] || '';
    return { id, name: `Campanha ${id}`, status: '', spend: safeNumber(row.costInLocalCurrency),
      impressions: safeNumber(row.impressions), clicks: safeNumber(row.clicks),
      conversions: safeNumber(row.externalWebsiteConversions) };
  });
  await Promise.all(campaigns.slice(0, 20).map(async (campaign: any) => {
    if (!campaign.id) return;
    try {
      const info = await linkedInJson(`/adAccounts/${accountId}/adCampaigns/${campaign.id}`, token);
      campaign.name = info.name || campaign.name;
      campaign.status = info.status || '';
    } catch { /* Reporting remains available when campaign details are restricted. */ }
  }));
  return { totals: { ...totals, ctr: totals.impressions ? totals.clicks / totals.impressions * 100 : 0,
    cpc: totals.clicks ? totals.spend / totals.clicks : 0 }, campaigns };
}

export async function getAdPlatformReport(connection: { platform: string; externalPageId: string | null;
  accessTokenEncrypted: string | null; tokenExpiresAt: Date | null; metadata: string | null }, range: string) {
  if (!connection.externalPageId || !connection.accessTokenEncrypted) throw new ValidationError('Conta sem credenciais. Conecte novamente.');
  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() < Date.now() + 60_000) {
    throw new ValidationError('A conexão expirou. Conecte a conta novamente.');
  }
  const token = decrypt(connection.accessTokenEncrypted);
  const report = connection.platform === 'TIKTOK_ADS'
    ? await tikTokInsights(connection.externalPageId, token, range)
    : await linkedInInsights(connection.externalPageId, token, range);
  let currency: string | null = null;
  try { currency = connection.metadata ? JSON.parse(connection.metadata).currency || null : null; } catch { /* legacy row */ }
  return { ...report, currency, range };
}
export async function insights(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const platform = parsePlatform(req.params.platform);
    const range = String(req.query.range || '7d');
    if (!['today', '7d', '30d'].includes(range)) throw new ValidationError('Período inválido.');
    const connection = await prisma.socialConnection.findFirst({ where: { id: req.params.id,
      agencyId: req.user!.agencyId, platform: dbPlatform(platform), status: 'ACTIVE' } });
    if (!connection) throw new NotFoundError('Conta não encontrada.');
    res.json(await getAdPlatformReport(connection, range));
  } catch (error) { next(error); }
}
