import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
import { encrypt, decrypt, maskSecret } from '../../common/crypto';
import { GRAPH_URL, GRAPH_VERSION, buildMetaRedirectUri, getAgencyMetaCredentials, exchangeCodeForLongLivedToken } from '../../integrations/meta/metaClient';
import { handleAdsMetaAuth } from '../ads/ads.controller';
import {
  LINKEDIN_API_URL, LINKEDIN_AUTH_URL, buildLinkedInRedirectUri, getAgencyLinkedInCredentials, exchangeLinkedInCode, linkedInHeaders, linkedInApiError,
} from '../../integrations/linkedin/linkedinClient';
import {
  TIKTOK_API_URL, TIKTOK_AUTH_URL, buildTikTokRedirectUri, getAgencyTikTokCredentials, exchangeTikTokCode, refreshTikTokToken, tiktokHeaders, tiktokApiError,
} from '../../integrations/tiktok/tiktokClient';
import {
  GOOGLE_AUTH_URL, YOUTUBE_API_URL, YOUTUBE_UPLOAD_URL, buildYouTubeRedirectUri, getAgencyYouTubeCredentials, exchangeYouTubeCode, refreshYouTubeToken, youtubeHeaders, youtubeApiError,
} from '../../integrations/youtube/youtubeClient';

// Derived from APP_URL (already required for CORS/portal links) instead of its own env var —
// every agency on this deployment shares the same physical callback endpoint (the App
// ID/Secret is what's per-agency, not this URL), and deriving it removes an entire class of
// "two env vars that must be kept in sync manually" bugs (wrong domain, wrong port...).
// Settings → Redes Sociais shows agencies this exact same computed value to paste into their
// Meta App, via window.location.origin on the frontend — the two only ever match if APP_URL is
// set correctly, which is already a hard requirement for the rest of the app to work at all.
function getMetaRedirectUri() {
  return buildMetaRedirectUri('/api/v1/social/meta/callback');
}

function getLinkedInRedirectUri() {
  return buildLinkedInRedirectUri('/api/v1/social/linkedin/callback');
}

function getTikTokRedirectUri() {
  return buildTikTokRedirectUri('/api/v1/social/tiktok/callback');
}

function getYouTubeRedirectUri() {
  return buildYouTubeRedirectUri('/api/v1/social/youtube/callback');
}

// ─── META APP SETTINGS (bring-your-own Meta App, per agency) ──────────────────

export async function getMetaSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.agencySocialSettings.findUnique({ where: { agencyId: req.user!.agencyId } });
    if (!settings?.metaAppId) {
      return res.json({ configured: false });
    }
    res.json({
      configured: true,
      metaAppId: settings.metaAppId,
      metaAppSecretMasked: settings.metaAppSecretEncrypted ? maskSecret(decrypt(settings.metaAppSecretEncrypted)) : null,
    });
  } catch (err) { next(err); }
}

export async function saveMetaSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { metaAppId, metaAppSecret } = req.body;
    if (!metaAppId || !metaAppSecret) {
      throw new ValidationError('Informe o App ID e o App Secret do seu Meta App.');
    }

    const existing = await prisma.agencySocialSettings.findUnique({ where: { agencyId: req.user!.agencyId } });
    const data = { metaAppId: String(metaAppId).trim(), metaAppSecretEncrypted: encrypt(String(metaAppSecret).trim()) };
    const settings = existing
      ? await prisma.agencySocialSettings.update({ where: { id: existing.id }, data })
      : await prisma.agencySocialSettings.create({ data: { agencyId: req.user!.agencyId, ...data } });

    res.json({ configured: true, metaAppId: settings.metaAppId, metaAppSecretMasked: maskSecret(String(metaAppSecret).trim()) });
  } catch (err) { next(err); }
}

export async function deleteMetaSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Nulls out only the Meta fields, not deleteMany — this row is shared with LinkedIn
    // credentials now, and deleting it outright would wipe those too.
    const existing = await prisma.agencySocialSettings.findUnique({ where: { agencyId: req.user!.agencyId } });
    if (existing) {
      await prisma.agencySocialSettings.update({
        where: { id: existing.id },
        data: { metaAppId: null, metaAppSecretEncrypted: null },
      });
    }
    res.json({ configured: false });
  } catch (err) { next(err); }
}

// ─── LINKEDIN APP SETTINGS (bring-your-own LinkedIn App, per agency) ───────────
// NOTE: reads/writes to linkedin_client_id/linkedin_client_secret_encrypted go through raw SQL
// instead of the typed Prisma delegate — same reason as agency_whatsapp_settings below: the
// columns were added via a hand-applied migration while Docker (the only working path to
// regenerate the Prisma Client here) wasn't reachable. The Prisma Client validates args against
// its generated schema at RUNTIME, so an `as any` cast doesn't help — it rejects "unknown
// argument" before the query is ever sent. Switch to `prisma.agencySocialSettings.*` once
// `npx prisma generate` has run somewhere with network access (e.g. the next Docker build).

export async function getLinkedInSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.$queryRaw<{ linkedin_client_id: string | null; linkedin_client_secret_encrypted: string | null }[]>`
      SELECT linkedin_client_id, linkedin_client_secret_encrypted FROM agency_social_settings WHERE agency_id = ${req.user!.agencyId} LIMIT 1
    `;
    const row = rows[0];
    if (!row?.linkedin_client_id) {
      return res.json({ configured: false });
    }
    res.json({
      configured: true,
      linkedinClientId: row.linkedin_client_id,
      linkedinClientSecretMasked: row.linkedin_client_secret_encrypted ? maskSecret(decrypt(row.linkedin_client_secret_encrypted)) : null,
    });
  } catch (err) { next(err); }
}

export async function saveLinkedInSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { linkedinClientId, linkedinClientSecret } = req.body;
    if (!linkedinClientId || !linkedinClientSecret) {
      throw new ValidationError('Informe o Client ID e o Client Secret do seu LinkedIn App.');
    }

    const agencyId = req.user!.agencyId;
    const clientId = String(linkedinClientId).trim();
    const clientSecretEncrypted = encrypt(String(linkedinClientSecret).trim());

    const existing = await prisma.agencySocialSettings.findUnique({ where: { agencyId } });
    if (existing) {
      await prisma.$executeRaw`
        UPDATE agency_social_settings SET linkedin_client_id = ${clientId}, linkedin_client_secret_encrypted = ${clientSecretEncrypted}, updated_at = NOW()
        WHERE agency_id = ${agencyId}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO agency_social_settings (id, agency_id, linkedin_client_id, linkedin_client_secret_encrypted, created_at, updated_at)
        VALUES (gen_random_uuid()::text, ${agencyId}, ${clientId}, ${clientSecretEncrypted}, NOW(), NOW())
      `;
    }

    res.json({ configured: true, linkedinClientId: clientId, linkedinClientSecretMasked: maskSecret(String(linkedinClientSecret).trim()) });
  } catch (err) { next(err); }
}

export async function deleteLinkedInSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.$executeRaw`
      UPDATE agency_social_settings SET linkedin_client_id = NULL, linkedin_client_secret_encrypted = NULL, updated_at = NOW()
      WHERE agency_id = ${req.user!.agencyId}
    `;
    res.json({ configured: false });
  } catch (err) { next(err); }
}

// ─── TIKTOK APP SETTINGS (bring-your-own TikTok App, per agency) ───────────────
// Same raw-SQL note as the LinkedIn settings above — tiktok_client_key/
// tiktok_client_secret_encrypted aren't in the locally-generated Prisma Client yet.

export async function getTikTokSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.$queryRaw<{ tiktok_client_key: string | null; tiktok_client_secret_encrypted: string | null }[]>`
      SELECT tiktok_client_key, tiktok_client_secret_encrypted FROM agency_social_settings WHERE agency_id = ${req.user!.agencyId} LIMIT 1
    `;
    const row = rows[0];
    if (!row?.tiktok_client_key) {
      return res.json({ configured: false });
    }
    res.json({
      configured: true,
      tiktokClientKey: row.tiktok_client_key,
      tiktokClientSecretMasked: row.tiktok_client_secret_encrypted ? maskSecret(decrypt(row.tiktok_client_secret_encrypted)) : null,
    });
  } catch (err) { next(err); }
}

export async function saveTikTokSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { tiktokClientKey, tiktokClientSecret } = req.body;
    if (!tiktokClientKey || !tiktokClientSecret) {
      throw new ValidationError('Informe o Client Key e o Client Secret do seu TikTok App.');
    }

    const agencyId = req.user!.agencyId;
    const clientKey = String(tiktokClientKey).trim();
    const clientSecretEncrypted = encrypt(String(tiktokClientSecret).trim());

    const existing = await prisma.agencySocialSettings.findUnique({ where: { agencyId } });
    if (existing) {
      await prisma.$executeRaw`
        UPDATE agency_social_settings SET tiktok_client_key = ${clientKey}, tiktok_client_secret_encrypted = ${clientSecretEncrypted}, updated_at = NOW()
        WHERE agency_id = ${agencyId}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO agency_social_settings (id, agency_id, tiktok_client_key, tiktok_client_secret_encrypted, created_at, updated_at)
        VALUES (gen_random_uuid()::text, ${agencyId}, ${clientKey}, ${clientSecretEncrypted}, NOW(), NOW())
      `;
    }

    res.json({ configured: true, tiktokClientKey: clientKey, tiktokClientSecretMasked: maskSecret(String(tiktokClientSecret).trim()) });
  } catch (err) { next(err); }
}

export async function deleteTikTokSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.$executeRaw`
      UPDATE agency_social_settings SET tiktok_client_key = NULL, tiktok_client_secret_encrypted = NULL, updated_at = NOW()
      WHERE agency_id = ${req.user!.agencyId}
    `;
    res.json({ configured: false });
  } catch (err) { next(err); }
}

// ─── YOUTUBE (GOOGLE) APP SETTINGS (bring-your-own Google Cloud project, per agency) ────
// Same raw-SQL note as the LinkedIn/TikTok settings above — youtube_client_id/
// youtube_client_secret_encrypted aren't in the locally-generated Prisma Client yet.

export async function getYouTubeSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.$queryRaw<{ youtube_client_id: string | null; youtube_client_secret_encrypted: string | null }[]>`
      SELECT youtube_client_id, youtube_client_secret_encrypted FROM agency_social_settings WHERE agency_id = ${req.user!.agencyId} LIMIT 1
    `;
    const row = rows[0];
    if (!row?.youtube_client_id) {
      return res.json({ configured: false });
    }
    res.json({
      configured: true,
      youtubeClientId: row.youtube_client_id,
      youtubeClientSecretMasked: row.youtube_client_secret_encrypted ? maskSecret(decrypt(row.youtube_client_secret_encrypted)) : null,
    });
  } catch (err) { next(err); }
}

export async function saveYouTubeSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { youtubeClientId, youtubeClientSecret } = req.body;
    if (!youtubeClientId || !youtubeClientSecret) {
      throw new ValidationError('Informe o Client ID e o Client Secret do seu projeto do Google Cloud.');
    }

    const agencyId = req.user!.agencyId;
    const clientId = String(youtubeClientId).trim();
    const clientSecretEncrypted = encrypt(String(youtubeClientSecret).trim());

    const existing = await prisma.agencySocialSettings.findUnique({ where: { agencyId } });
    if (existing) {
      await prisma.$executeRaw`
        UPDATE agency_social_settings SET youtube_client_id = ${clientId}, youtube_client_secret_encrypted = ${clientSecretEncrypted}, updated_at = NOW()
        WHERE agency_id = ${agencyId}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO agency_social_settings (id, agency_id, youtube_client_id, youtube_client_secret_encrypted, created_at, updated_at)
        VALUES (gen_random_uuid()::text, ${agencyId}, ${clientId}, ${clientSecretEncrypted}, NOW(), NOW())
      `;
    }

    res.json({ configured: true, youtubeClientId: clientId, youtubeClientSecretMasked: maskSecret(String(youtubeClientSecret).trim()) });
  } catch (err) { next(err); }
}

export async function deleteYouTubeSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.$executeRaw`
      UPDATE agency_social_settings SET youtube_client_id = NULL, youtube_client_secret_encrypted = NULL, updated_at = NOW()
      WHERE agency_id = ${req.user!.agencyId}
    `;
    res.json({ configured: false });
  } catch (err) { next(err); }
}

function serializeConnection(c: any) {
  return {
    id: c.id,
    clientId: c.clientId,
    platform: c.platform,
    accountName: c.accountName,
    externalPageId: c.externalPageId,
    status: c.status,
    connectedAt: c.createdAt,
    tokenExpiresAt: c.tokenExpiresAt,
  };
}

async function upsertConnection(where: { agencyId: string; clientId: string; platform: string; externalPageId?: string | null }, data: any) {
  const existing = await prisma.socialConnection.findFirst({ where });
  if (existing) {
    return prisma.socialConnection.update({ where: { id: existing.id }, data });
  }
  return prisma.socialConnection.create({ data: { ...where, ...data } });
}

// Atomic upsert on the (contentId, platform) unique constraint — used by every publishTo*
// function to record the outcome of a publish attempt. Replaces an earlier find-then-create/
// update pattern that raced: two publish attempts landing close together (e.g. a manual click
// and the scheduled publisher picking up the same due content around the same time) could both
// see "no existing row" and both insert one, leaving duplicate/stale rows behind — confirmed
// happening for real with a slow WhatsApp Status publish. Raw SQL (`ON CONFLICT`) instead of
// `prisma.contentPlatform.upsert` because the local Prisma Client can't be regenerated in this
// environment (no Docker/network access here) to pick up the new unique constraint — switch to
// the typed `upsert` once `npx prisma generate` has run somewhere with network access.
async function upsertContentPlatformStatus(params: {
  agencyId: string; contentId: string; platform: string; status: string;
  externalPostId?: string | null; externalPostUrl?: string | null; publishedAt?: Date | null; publishError?: string | null;
}) {
  const { agencyId, contentId, platform, status, externalPostId = null, externalPostUrl = null, publishedAt = null, publishError = null } = params;
  await prisma.$executeRaw`
    INSERT INTO content_platforms (id, agency_id, content_id, platform, enabled, status, external_post_id, external_post_url, published_at, publish_error, created_at, updated_at)
    VALUES (gen_random_uuid()::text, ${agencyId}, ${contentId}, ${platform}, true, ${status}, ${externalPostId}, ${externalPostUrl}, ${publishedAt}, ${publishError}, NOW(), NOW())
    ON CONFLICT (content_id, platform) DO UPDATE SET
      status = EXCLUDED.status,
      external_post_id = EXCLUDED.external_post_id,
      external_post_url = EXCLUDED.external_post_url,
      published_at = EXCLUDED.published_at,
      publish_error = EXCLUDED.publish_error,
      updated_at = NOW()
  `;
}

// ─── SHARED ──────────────────────────────────────────────────────────────────

export async function listConnections(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.query;
    const where: any = { agencyId: req.user!.agencyId };
    if (clientId) where.clientId = clientId;

    const connections = await prisma.socialConnection.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(connections.map(serializeConnection));
  } catch (err) { next(err); }
}

// WhatsApp is agency-scoped (see whatsappDisconnect below) and never creates a SocialConnection
// row, so this only ever handles FACEBOOK/INSTAGRAM connections.
export async function deleteConnection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const connection = await prisma.socialConnection.findFirst({
      where: { id: req.params.id, agencyId: req.user!.agencyId },
    });
    if (!connection) throw new NotFoundError('Connection not found');

    await prisma.socialConnection.delete({ where: { id: connection.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// ─── META (FACEBOOK + INSTAGRAM) ────────────────────────────────────────────

export async function metaConnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const credentials = await getAgencyMetaCredentials(req.user!.agencyId);
    if (!credentials) {
      return res.status(400).json({ error: 'Configure o Meta App ID e Secret da sua agência primeiro (abaixo).' });
    }
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    const client = await prisma.client.findFirst({ where: { id: String(clientId), agencyId: req.user!.agencyId } });
    if (!client) throw new NotFoundError('Client not found');

    const state = Buffer.from(JSON.stringify({ clientId, agencyId: req.user!.agencyId, userId: req.user!.id })).toString('base64url');
    const scopes = [
      'pages_show_list', 'pages_read_engagement', 'pages_manage_posts',
      'instagram_basic', 'instagram_content_publish', 'business_management',
    ].join(',');

    const authUrl = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?` + new URLSearchParams({
      client_id: credentials.appId,
      redirect_uri: getMetaRedirectUri(),
      state,
      scope: scopes,
      response_type: 'code',
    }).toString();

    res.json({ authUrl });
  } catch (err) { next(err); }
}

async function connectPageToClient(
  params: { agencyId: string; clientId: string; userId: string },
  page: { id: string; name: string; access_token: string; instagram_business_account?: { id: string } }
) {
  await upsertConnection(
    { agencyId: params.agencyId, clientId: params.clientId, platform: 'FACEBOOK', externalPageId: page.id },
    { accountName: page.name, accessTokenEncrypted: encrypt(page.access_token), status: 'ACTIVE', connectedBy: params.userId }
  );

  if (page.instagram_business_account?.id) {
    const igId = page.instagram_business_account.id;
    const igInfoRes = await fetch(`${GRAPH_URL}/${igId}?fields=username&access_token=${page.access_token}`);
    const igInfo = await igInfoRes.json() as any;

    await upsertConnection(
      { agencyId: params.agencyId, clientId: params.clientId, platform: 'INSTAGRAM', externalPageId: igId },
      { accountName: igInfo.username || 'Instagram', accessTokenEncrypted: encrypt(page.access_token), status: 'ACTIVE', connectedBy: params.userId }
    );
  }
}

// Pages fetched from a Meta OAuth callback wait here, briefly, when there's more than one —
// e.g. the agency's Facebook user has Business Manager Partner Access to several clients'
// Pages at once, so `/me/accounts` returns all of them and we can't tell which one belongs to
// the client being connected without asking. Single-page connects (the common case) skip this
// entirely and finish immediately. In-memory + short TTL is enough: single Docker container,
// and a stale entry just means the agency has to click "Conectar Facebook" again.
const PENDING_TTL_MS = 10 * 60 * 1000;
const pendingPageSelections = new Map<string, {
  agencyId: string; clientId: string; userId: string; expiresAt: number;
  pages: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }>;
}>();

function cleanupExpiredPendingSelections() {
  const now = Date.now();
  for (const [token, entry] of pendingPageSelections) {
    if (entry.expiresAt < now) pendingPageSelections.delete(token);
  }
}

export async function metaCallback(req: Request, res: Response, next: NextFunction) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    const { code, state, error: metaError } = req.query;
    if (metaError || !code || !state) {
      return res.redirect(`${appUrl}/app/social?social_error=1`);
    }

    const { clientId, agencyId, userId, flow } = JSON.parse(Buffer.from(String(state), 'base64url').toString());

    const credentials = await getAgencyMetaCredentials(agencyId);
    if (!credentials) throw new Error('Meta App credentials not configured for this agency');

    // Exchange code for a short-lived user token, then extend it to long-lived.
    const userAccessToken = await exchangeCodeForLongLivedToken(credentials, String(code), getMetaRedirectUri());

    // The Ads module (Meta Ad Accounts) reuses this exact callback instead of registering its
    // own redirect_uri — see the comment on adsConnect in ads.controller.ts for why. Dispatch
    // there and stop before the Pages-specific logic below, which doesn't apply to this flow.
    if (flow === 'ads') {
      const query = await handleAdsMetaAuth({ agencyId, clientId, userId, accessToken: userAccessToken });
      return res.redirect(`${appUrl}/app/ads?${query}`);
    }

    // Fetch the Pages this user manages, and any linked Instagram Business Account.
    const pagesRes = await fetch(`${GRAPH_URL}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`);
    const pagesData = await pagesRes.json() as any;
    if (!pagesRes.ok) throw new Error(pagesData.error?.message || 'Failed to list Facebook Pages');

    const pages = pagesData.data || [];

    if (pages.length > 1) {
      // Ambiguous — likely Business Manager Partner Access to multiple clients' Pages at
      // once. Don't guess: let the agency pick which Page(s) actually belong to this client.
      cleanupExpiredPendingSelections();
      const token = Buffer.from(`${Date.now()}-${Math.random().toString(36).slice(2)}`).toString('base64url');
      pendingPageSelections.set(token, { agencyId, clientId, userId, expiresAt: Date.now() + PENDING_TTL_MS, pages });
      return res.redirect(`${appUrl}/app/social?social_select_page=1&token=${token}&clientId=${clientId}`);
    }

    for (const page of pages) {
      await connectPageToClient({ agencyId, clientId, userId }, page);
    }

    res.redirect(`${appUrl}/app/social?social_connected=1&clientId=${clientId}`);
  } catch (err) {
    console.error('Meta OAuth callback failed:', err);
    res.redirect(`${appUrl}/app/social?social_error=1`);
  }
}

export async function getPendingPageSelection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    cleanupExpiredPendingSelections();
    const entry = pendingPageSelections.get(req.params.token);
    if (!entry || entry.agencyId !== req.user!.agencyId) throw new NotFoundError('Seleção expirada ou inválida. Clique em Conectar Facebook novamente.');

    res.json({
      clientId: entry.clientId,
      pages: entry.pages.map((p) => ({ id: p.id, name: p.name, hasInstagram: !!p.instagram_business_account?.id })),
    });
  } catch (err) { next(err); }
}

export async function confirmPageSelection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    cleanupExpiredPendingSelections();
    const entry = pendingPageSelections.get(req.params.token);
    if (!entry || entry.agencyId !== req.user!.agencyId) throw new NotFoundError('Seleção expirada ou inválida. Clique em Conectar Facebook novamente.');

    const { pageIds } = req.body as { pageIds: string[] };
    if (!Array.isArray(pageIds) || pageIds.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos uma página.' });
    }

    const selected = entry.pages.filter((p) => pageIds.includes(p.id));
    for (const page of selected) {
      await connectPageToClient({ agencyId: entry.agencyId, clientId: entry.clientId, userId: entry.userId }, page);
    }

    pendingPageSelections.delete(req.params.token);
    res.json({ connected: selected.length });
  } catch (err) { next(err); }
}

// ─── LINKEDIN (Organization/Company Page posts) ─────────────────────────────
// v1 scope: text + at most one image, posted to a Company Page the connecting user
// administers. Video is deliberately out of scope — LinkedIn's video upload flow needs
// chunked uploads, meaningfully more complex than the image flow below.

export async function linkedinConnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const credentials = await getAgencyLinkedInCredentials(req.user!.agencyId);
    if (!credentials) {
      return res.status(400).json({ error: 'Configure o Client ID e Secret do seu LinkedIn App da sua agência primeiro (abaixo).' });
    }
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    const client = await prisma.client.findFirst({ where: { id: String(clientId), agencyId: req.user!.agencyId } });
    if (!client) throw new NotFoundError('Client not found');

    const state = Buffer.from(JSON.stringify({ clientId, agencyId: req.user!.agencyId, userId: req.user!.id })).toString('base64url');
    const scopes = ['openid', 'profile', 'w_organization_social', 'r_organization_admin'].join(' ');

    const authUrl = `${LINKEDIN_AUTH_URL}/authorization?` + new URLSearchParams({
      response_type: 'code',
      client_id: credentials.clientId,
      redirect_uri: getLinkedInRedirectUri(),
      state,
      scope: scopes,
    }).toString();

    res.json({ authUrl });
  } catch (err) { next(err); }
}

async function connectOrgToClient(
  params: { agencyId: string; clientId: string; userId: string },
  org: { urn: string; name: string },
  token: { accessToken: string; expiresIn: number }
) {
  await upsertConnection(
    { agencyId: params.agencyId, clientId: params.clientId, platform: 'LINKEDIN', externalPageId: org.urn },
    {
      accountName: org.name,
      accessTokenEncrypted: encrypt(token.accessToken),
      tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000),
      status: 'ACTIVE',
      connectedBy: params.userId,
    }
  );
}

// Same shape/purpose as pendingPageSelections above, kept as its own Map rather than a shared
// abstraction — each platform module stays self-contained and easy to reason about on its own.
const pendingOrgSelections = new Map<string, {
  agencyId: string; clientId: string; userId: string; expiresAt: number;
  orgs: Array<{ urn: string; name: string }>;
  token: { accessToken: string; expiresIn: number };
}>();

function cleanupExpiredPendingOrgSelections() {
  const now = Date.now();
  for (const [token, entry] of pendingOrgSelections) {
    if (entry.expiresAt < now) pendingOrgSelections.delete(token);
  }
}

export async function linkedinCallback(req: Request, res: Response, next: NextFunction) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    const { code, state, error: liError } = req.query;
    if (liError || !code || !state) {
      return res.redirect(`${appUrl}/app/social?social_error=1`);
    }

    const { clientId, agencyId, userId } = JSON.parse(Buffer.from(String(state), 'base64url').toString());

    const credentials = await getAgencyLinkedInCredentials(agencyId);
    if (!credentials) throw new Error('LinkedIn App credentials not configured for this agency');

    const token = await exchangeLinkedInCode(credentials, String(code), getLinkedInRedirectUri());

    // Organizations the connecting user administers — the LinkedIn equivalent of Meta's
    // /me/accounts Pages list.
    const orgsRes = await fetch(
      `${LINKEDIN_API_URL}/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(localizedName,id)))`,
      { headers: linkedInHeaders(token.accessToken) }
    );
    if (!orgsRes.ok) throw await linkedInApiError(orgsRes);
    const orgsData = await orgsRes.json() as any;

    const orgs: Array<{ urn: string; name: string }> = (orgsData.elements || [])
      .map((el: any) => el['organization~'] && { urn: `urn:li:organization:${el['organization~'].id}`, name: el['organization~'].localizedName })
      .filter(Boolean);

    if (orgs.length === 0) {
      throw new Error('Nenhuma Página de Empresa encontrada. Verifique se você é Administrador da Página no LinkedIn.');
    }

    if (orgs.length > 1) {
      cleanupExpiredPendingOrgSelections();
      const pendingToken = Buffer.from(`${Date.now()}-${Math.random().toString(36).slice(2)}`).toString('base64url');
      pendingOrgSelections.set(pendingToken, { agencyId, clientId, userId, expiresAt: Date.now() + PENDING_TTL_MS, orgs, token });
      return res.redirect(`${appUrl}/app/social?social_select_org=1&token=${pendingToken}&clientId=${clientId}`);
    }

    await connectOrgToClient({ agencyId, clientId, userId }, orgs[0], token);
    res.redirect(`${appUrl}/app/social?social_connected=1&clientId=${clientId}`);
  } catch (err) {
    console.error('LinkedIn OAuth callback failed:', err);
    res.redirect(`${appUrl}/app/social?social_error=1`);
  }
}

export async function getPendingOrgSelection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    cleanupExpiredPendingOrgSelections();
    const entry = pendingOrgSelections.get(req.params.token);
    if (!entry || entry.agencyId !== req.user!.agencyId) throw new NotFoundError('Seleção expirada ou inválida. Clique em Conectar LinkedIn novamente.');

    res.json({ clientId: entry.clientId, orgs: entry.orgs });
  } catch (err) { next(err); }
}

export async function confirmOrgSelection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    cleanupExpiredPendingOrgSelections();
    const entry = pendingOrgSelections.get(req.params.token);
    if (!entry || entry.agencyId !== req.user!.agencyId) throw new NotFoundError('Seleção expirada ou inválida. Clique em Conectar LinkedIn novamente.');

    const { orgUrns } = req.body as { orgUrns: string[] };
    if (!Array.isArray(orgUrns) || orgUrns.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos uma organização.' });
    }

    const selected = entry.orgs.filter((o) => orgUrns.includes(o.urn));
    for (const org of selected) {
      await connectOrgToClient({ agencyId: entry.agencyId, clientId: entry.clientId, userId: entry.userId }, org, entry.token);
    }

    pendingOrgSelections.delete(req.params.token);
    res.json({ connected: selected.length });
  } catch (err) { next(err); }
}

export async function publishToLinkedIn(params: {
  agencyId: string; contentId: string;
}): Promise<{ success: boolean; externalPostId?: string; externalPostUrl?: string; error?: string }> {
  const { agencyId, contentId } = params;
  try {
    const content = await prisma.content.findFirst({
      where: { id: contentId, agencyId, deletedAt: null },
      include: { assets: { where: { role: 'PRIMARY' }, include: { asset: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!content) throw new Error('Content not found');

    const connection = await prisma.socialConnection.findFirst({
      where: { agencyId, clientId: content.clientId, platform: 'LINKEDIN', status: 'ACTIVE' },
    });
    if (!connection || !connection.accessTokenEncrypted) {
      throw new Error('Nenhuma conta do LinkedIn conectada para este cliente.');
    }

    const mediaList = content.assets.map((a) => a.asset);
    const media = mediaList[0];
    const isImage = !!media?.mimeType?.startsWith('image/');
    const token = decrypt(connection.accessTokenEncrypted);
    const caption = [content.hook, content.caption, content.cta].filter(Boolean).join('\n\n');
    const author = connection.externalPageId!;

    // Uploads a single image via LinkedIn's init/PUT flow (same mechanics either way), returning
    // its image URN — used once for a single-image post, in a loop for a multi-image one.
    async function uploadLinkedInImage(publicUrl: string): Promise<string> {
      const initRes = await fetch(`${LINKEDIN_API_URL}/rest/images?action=initializeUpload`, {
        method: 'POST',
        headers: linkedInHeaders(token),
        body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
      });
      if (!initRes.ok) throw await linkedInApiError(initRes);
      const initData = await initRes.json() as any;
      const uploadUrl = initData.value.uploadUrl;
      const imageUrn = initData.value.image;

      const imageBytes = await (await fetch(publicUrl)).arrayBuffer();
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', body: Buffer.from(imageBytes) });
      if (!uploadRes.ok) throw new Error('Falha ao enviar uma das imagens para o LinkedIn.');
      return imageUrn;
    }

    let mediaId: string | undefined;
    let multiImageIds: string[] | undefined;
    if (mediaList.length > 1 && mediaList.every((m) => m.mimeType.startsWith('image/'))) {
      // Carousel (2-20 images per LinkedIn's multiImage limit — our own upload cap of 10 stays
      // well under that).
      multiImageIds = [];
      for (const m of mediaList) {
        if (!m.publicUrl) throw new Error('Uma das imagens não tem URL pública disponível ainda. Tente novamente em instantes.');
        multiImageIds.push(await uploadLinkedInImage(m.publicUrl));
      }
    } else if (media && isImage) {
      if (!media.publicUrl) throw new Error('O criativo não tem uma URL pública disponível ainda. Tente novamente em instantes.');
      mediaId = await uploadLinkedInImage(media.publicUrl);
    } else if (media && !isImage) {
      throw new Error('O LinkedIn ainda só suporta publicação de imagem por aqui — vídeos não são suportados no momento.');
    }

    const postRes = await fetch(`${LINKEDIN_API_URL}/rest/posts`, {
      method: 'POST',
      headers: linkedInHeaders(token),
      body: JSON.stringify({
        author,
        commentary: caption,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
        ...(multiImageIds && { content: { multiImage: { images: multiImageIds.map((id) => ({ id })) } } }),
        ...(mediaId && { content: { media: { id: mediaId } } }),
      }),
    });
    if (!postRes.ok) throw await linkedInApiError(postRes);

    const externalPostId = postRes.headers.get('x-restli-id') || postRes.headers.get('x-linkedin-id') || '';
    const externalPostUrl = externalPostId ? `https://www.linkedin.com/feed/update/${externalPostId}/` : undefined;

    await upsertContentPlatformStatus({ agencyId, contentId, platform: 'LINKEDIN', status: 'PUBLISHED', externalPostId, externalPostUrl, publishedAt: new Date() });

    return { success: true, externalPostId, externalPostUrl };
  } catch (err: any) {
    await upsertContentPlatformStatus({ agencyId, contentId, platform: 'LINKEDIN', status: 'FAILED', publishError: err.message }).catch(() => {});
    return { success: false, error: err.message || 'Erro ao publicar no LinkedIn.' };
  }
}

// ─── TIKTOK ──────────────────────────────────────────────────────────────────
// v1 scope: video only (photo posts only support PULL_FROM_URL on TikTok's side, which needs
// domain verification of wherever the media is hosted — impractical per-agency since they all
// share this SaaS's own storage domain, not one they individually control). Single-chunk
// FILE_UPLOAD only (≤64MB) — true multi-chunk upload is a documented future gap, same spirit as
// LinkedIn's video exclusion. No Page/Organization picker — TikTok OAuth connects exactly one
// account (open_id) per authorization, unlike Meta Pages or LinkedIn Organizations.

export async function tiktokConnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const credentials = await getAgencyTikTokCredentials(req.user!.agencyId);
    if (!credentials) {
      return res.status(400).json({ error: 'Configure o Client Key e Secret do seu TikTok App da sua agência primeiro (abaixo).' });
    }
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    const client = await prisma.client.findFirst({ where: { id: String(clientId), agencyId: req.user!.agencyId } });
    if (!client) throw new NotFoundError('Client not found');

    const state = Buffer.from(JSON.stringify({ clientId, agencyId: req.user!.agencyId, userId: req.user!.id })).toString('base64url');
    const scopes = ['user.info.basic', 'video.publish'].join(',');

    const authUrl = `${TIKTOK_AUTH_URL}?` + new URLSearchParams({
      client_key: credentials.clientKey,
      response_type: 'code',
      redirect_uri: getTikTokRedirectUri(),
      state,
      scope: scopes,
    }).toString();

    res.json({ authUrl });
  } catch (err) { next(err); }
}

export async function tiktokCallback(req: Request, res: Response, next: NextFunction) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    const { code, state, error: ttError } = req.query;
    if (ttError || !code || !state) {
      return res.redirect(`${appUrl}/app/social?social_error=1`);
    }

    const { clientId, agencyId, userId } = JSON.parse(Buffer.from(String(state), 'base64url').toString());

    const credentials = await getAgencyTikTokCredentials(agencyId);
    if (!credentials) throw new Error('TikTok App credentials not configured for this agency');

    const token = await exchangeTikTokCode(credentials, String(code), getTikTokRedirectUri());

    // No Page/Org picker needed — one account per authorization. Fetch the display name once,
    // best-effort, so the connections list shows something better than a bare open_id.
    let accountName = 'TikTok';
    try {
      const infoRes = await fetch(`${TIKTOK_API_URL}/v2/post/publish/creator_info/query/`, {
        method: 'POST',
        headers: tiktokHeaders(token.accessToken),
      });
      if (infoRes.ok) {
        const infoData = await infoRes.json() as any;
        accountName = infoData.data?.creator_nickname || accountName;
      }
    } catch {
      // Non-fatal — the connection still works without a display name.
    }

    await upsertConnection(
      { agencyId, clientId, platform: 'TIKTOK', externalPageId: token.openId },
      {
        accountName,
        accessTokenEncrypted: encrypt(token.accessToken),
        refreshTokenEncrypted: encrypt(token.refreshToken),
        tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000),
        status: 'ACTIVE',
        connectedBy: userId,
      }
    );

    res.redirect(`${appUrl}/app/social?social_connected=1&clientId=${clientId}`);
  } catch (err) {
    console.error('TikTok OAuth callback failed:', err);
    res.redirect(`${appUrl}/app/social?social_error=1`);
  }
}

// TikTok access tokens last only 24h — unlike Meta/LinkedIn's ~60-day tokens, a scheduled post
// even a day after connecting needs a real refresh, not just "reconnect occasionally". Called
// at the top of publishToTikTok; refreshes ~1h before expiry to leave margin for the publish
// flow itself (upload + status polling can take a couple minutes).
async function getValidTikTokAccessToken(connection: { id: string; accessTokenEncrypted: string | null; refreshTokenEncrypted: string | null; tokenExpiresAt: Date | null }, credentials: { clientKey: string; clientSecret: string }): Promise<string> {
  const oneHourFromNow = Date.now() + 60 * 60 * 1000;
  if (connection.accessTokenEncrypted && connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() > oneHourFromNow) {
    return decrypt(connection.accessTokenEncrypted);
  }
  if (!connection.refreshTokenEncrypted) throw new Error('Conexão do TikTok expirada — reconecte a conta.');

  const refreshed = await refreshTikTokToken(credentials, decrypt(connection.refreshTokenEncrypted));
  await prisma.socialConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encrypt(refreshed.accessToken),
      refreshTokenEncrypted: encrypt(refreshed.refreshToken),
      tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
    },
  });
  return refreshed.accessToken;
}

async function waitForTikTokPublish(publishId: string, token: string): Promise<{ status: string; publicPostId?: string; failReason?: string }> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await fetch(`${TIKTOK_API_URL}/v2/post/publish/status/fetch/`, {
      method: 'POST',
      headers: tiktokHeaders(token),
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = await res.json() as any;
    const status = data.data?.status;
    if (status === 'PUBLISH_COMPLETE') {
      return { status, publicPostId: data.data?.publicaly_available_post_id?.[0] };
    }
    if (status === 'FAILED') {
      return { status, failReason: data.data?.fail_reason };
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return { status: 'TIMEOUT' };
}

export async function publishToTikTok(params: {
  agencyId: string; contentId: string;
}): Promise<{ success: boolean; externalPostId?: string; externalPostUrl?: string; error?: string }> {
  const { agencyId, contentId } = params;
  try {
    const content = await prisma.content.findFirst({
      where: { id: contentId, agencyId, deletedAt: null },
      include: { assets: { where: { role: 'PRIMARY' }, include: { asset: true }, orderBy: { sortOrder: 'asc' }, take: 1 } },
    });
    if (!content) throw new Error('Content not found');

    const connection = await prisma.socialConnection.findFirst({
      where: { agencyId, clientId: content.clientId, platform: 'TIKTOK', status: 'ACTIVE' },
    });
    if (!connection || !connection.accessTokenEncrypted) {
      throw new Error('Nenhuma conta do TikTok conectada para este cliente.');
    }

    const credentials = await getAgencyTikTokCredentials(agencyId);
    if (!credentials) throw new Error('TikTok App credentials not configured for this agency');

    const media = content.assets[0]?.asset;
    const isVideo = !!media?.mimeType?.startsWith('video/');
    if (!media || !isVideo) {
      throw new Error('O TikTok neste app só publica vídeo por enquanto — gere ou envie um vídeo primeiro.');
    }
    if (!media.publicUrl) throw new Error('O criativo não tem uma URL pública disponível ainda. Tente novamente em instantes.');

    const token = await getValidTikTokAccessToken(connection, credentials);
    const caption = [content.hook, content.caption, content.cta].filter(Boolean).join('\n\n');

    // Query the account's real, current privacy options — unaudited apps are restricted to
    // SELF_ONLY by TikTok itself, so we just respect whatever the API actually returns rather
    // than hardcoding a value.
    const creatorRes = await fetch(`${TIKTOK_API_URL}/v2/post/publish/creator_info/query/`, {
      method: 'POST', headers: tiktokHeaders(token),
    });
    if (!creatorRes.ok) throw await tiktokApiError(creatorRes);
    const creatorData = await creatorRes.json() as any;
    const privacyOptions: string[] = creatorData.data?.privacy_level_options || ['SELF_ONLY'];
    const privacyLevel = privacyOptions.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : privacyOptions[0];

    const videoBytes = Buffer.from(await (await fetch(media.publicUrl)).arrayBuffer());
    const MAX_SINGLE_CHUNK_BYTES = 64 * 1024 * 1024;
    if (videoBytes.byteLength > MAX_SINGLE_CHUNK_BYTES) {
      throw new Error('Vídeo maior que 64MB — reduza o tamanho do arquivo. Uploads em múltiplas partes ainda não são suportados para o TikTok.');
    }

    const initRes = await fetch(`${TIKTOK_API_URL}/v2/post/publish/video/init/`, {
      method: 'POST',
      headers: tiktokHeaders(token),
      body: JSON.stringify({
        post_info: { title: caption, privacy_level: privacyLevel, disable_duet: false, disable_comment: false, disable_stitch: false },
        source_info: { source: 'FILE_UPLOAD', video_size: videoBytes.byteLength, chunk_size: videoBytes.byteLength, total_chunk_count: 1 },
      }),
    });
    if (!initRes.ok) throw await tiktokApiError(initRes);
    const initData = await initRes.json() as any;
    const publishId = initData.data.publish_id;
    const uploadUrl = initData.data.upload_url;

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(videoBytes.byteLength),
        'Content-Range': `bytes 0-${videoBytes.byteLength - 1}/${videoBytes.byteLength}`,
      },
      body: videoBytes,
    });
    if (!uploadRes.ok) throw new Error('Falha ao enviar o vídeo para o TikTok.');

    const result = await waitForTikTokPublish(publishId, token);
    if (result.status === 'FAILED') throw new Error(result.failReason || 'Falha ao publicar no TikTok.');
    if (result.status === 'TIMEOUT') throw new Error('O TikTok demorou demais para processar o vídeo. Tente novamente em alguns minutos.');

    const externalPostId = result.publicPostId || publishId;
    // TikTok doesn't hand back a ready-to-use watch URL, and we don't reliably have the
    // account's @handle stored (only its display name) to build one ourselves — leave it
    // unset rather than construct a link that might not resolve. externalPostId still lets
    // support/debugging reference the exact post via TikTok's own API.
    const externalPostUrl: string | undefined = undefined;

    await upsertContentPlatformStatus({ agencyId, contentId, platform: 'TIKTOK', status: 'PUBLISHED', externalPostId, externalPostUrl, publishedAt: new Date() });

    return { success: true, externalPostId, externalPostUrl };
  } catch (err: any) {
    await upsertContentPlatformStatus({ agencyId, contentId, platform: 'TIKTOK', status: 'FAILED', publishError: err.message }).catch(() => {});
    return { success: false, error: err.message || 'Erro ao publicar no TikTok.' };
  }
}

// ─── YOUTUBE ─────────────────────────────────────────────────────────────────
// v1 scope: video only (YouTube has no photo post concept anyway). Single PUT for the whole
// file — YouTube's resumable upload protocol accepts one PUT with the entire body, unlike
// TikTok's forced chunk parameters. No channel picker — the public API has no clean way to
// list every channel an account manages, only `channels?mine=true` for the current one, same
// "one account per authorization" shape as TikTok.

export async function youtubeConnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const credentials = await getAgencyYouTubeCredentials(req.user!.agencyId);
    if (!credentials) {
      return res.status(400).json({ error: 'Configure o Client ID e Secret do seu projeto do Google Cloud da sua agência primeiro (abaixo).' });
    }
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    const client = await prisma.client.findFirst({ where: { id: String(clientId), agencyId: req.user!.agencyId } });
    if (!client) throw new NotFoundError('Client not found');

    const state = Buffer.from(JSON.stringify({ clientId, agencyId: req.user!.agencyId, userId: req.user!.id })).toString('base64url');

    // access_type=offline + prompt=consent are required — without them Google never returns a
    // refresh_token, and the connection would silently stop working after ~1h with no recovery
    // short of reconnecting.
    const authUrl = `${GOOGLE_AUTH_URL}?` + new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: getYouTubeRedirectUri(),
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.upload',
      access_type: 'offline',
      prompt: 'consent',
      state,
    }).toString();

    res.json({ authUrl });
  } catch (err) { next(err); }
}

export async function youtubeCallback(req: Request, res: Response, next: NextFunction) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    const { code, state, error: ytError } = req.query;
    if (ytError || !code || !state) {
      return res.redirect(`${appUrl}/app/social?social_error=1`);
    }

    const { clientId, agencyId, userId } = JSON.parse(Buffer.from(String(state), 'base64url').toString());

    const credentials = await getAgencyYouTubeCredentials(agencyId);
    if (!credentials) throw new Error('Google App credentials not configured for this agency');

    const token = await exchangeYouTubeCode(credentials, String(code), getYouTubeRedirectUri());

    // No channel picker — one channel per authorization. Fetch the channel connected to this
    // Google account/token.
    const channelRes = await fetch(`${YOUTUBE_API_URL}/channels?part=snippet&mine=true`, {
      headers: youtubeHeaders(token.accessToken),
    });
    if (!channelRes.ok) throw await youtubeApiError(channelRes);
    const channelData = await channelRes.json() as any;
    const channel = channelData.items?.[0];
    if (!channel) throw new Error('Nenhum canal do YouTube encontrado para esta conta do Google.');

    await upsertConnection(
      { agencyId, clientId, platform: 'YOUTUBE', externalPageId: channel.id },
      {
        accountName: channel.snippet?.title || 'YouTube',
        accessTokenEncrypted: encrypt(token.accessToken),
        refreshTokenEncrypted: encrypt(token.refreshToken),
        tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000),
        status: 'ACTIVE',
        connectedBy: userId,
      }
    );

    res.redirect(`${appUrl}/app/social?social_connected=1&clientId=${clientId}`);
  } catch (err) {
    console.error('YouTube OAuth callback failed:', err);
    res.redirect(`${appUrl}/app/social?social_error=1`);
  }
}

// Google access tokens last only ~1h — even shorter than TikTok's 24h — so this is checked
// with a tighter refresh window. Google normally doesn't re-issue a new refresh_token on
// refresh, so only accessTokenEncrypted/tokenExpiresAt are updated here.
async function getValidYouTubeAccessToken(connection: { id: string; accessTokenEncrypted: string | null; refreshTokenEncrypted: string | null; tokenExpiresAt: Date | null }, credentials: { clientId: string; clientSecret: string }): Promise<string> {
  const tenMinFromNow = Date.now() + 10 * 60 * 1000;
  if (connection.accessTokenEncrypted && connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() > tenMinFromNow) {
    return decrypt(connection.accessTokenEncrypted);
  }
  if (!connection.refreshTokenEncrypted) throw new Error('Conexão do YouTube expirada — reconecte a conta.');

  const refreshed = await refreshYouTubeToken(credentials, decrypt(connection.refreshTokenEncrypted));
  await prisma.socialConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encrypt(refreshed.accessToken),
      tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
    },
  });
  return refreshed.accessToken;
}

export async function publishToYouTube(params: {
  agencyId: string; contentId: string;
}): Promise<{ success: boolean; externalPostId?: string; externalPostUrl?: string; error?: string }> {
  const { agencyId, contentId } = params;
  try {
    const content = await prisma.content.findFirst({
      where: { id: contentId, agencyId, deletedAt: null },
      include: { assets: { where: { role: 'PRIMARY' }, include: { asset: true }, orderBy: { sortOrder: 'asc' }, take: 1 } },
    });
    if (!content) throw new Error('Content not found');

    const connection = await prisma.socialConnection.findFirst({
      where: { agencyId, clientId: content.clientId, platform: 'YOUTUBE', status: 'ACTIVE' },
    });
    if (!connection || !connection.accessTokenEncrypted) {
      throw new Error('Nenhuma conta do YouTube conectada para este cliente.');
    }

    const credentials = await getAgencyYouTubeCredentials(agencyId);
    if (!credentials) throw new Error('Google App credentials not configured for this agency');

    const media = content.assets[0]?.asset;
    const isVideo = !!media?.mimeType?.startsWith('video/');
    if (!media || !isVideo) {
      throw new Error('O YouTube só publica vídeo — gere ou envie um vídeo primeiro.');
    }
    if (!media.publicUrl) throw new Error('O criativo não tem uma URL pública disponível ainda. Tente novamente em instantes.');

    const token = await getValidYouTubeAccessToken(connection, credentials);
    const caption = [content.hook, content.caption, content.cta].filter(Boolean).join('\n\n');

    const videoBytes = Buffer.from(await (await fetch(media.publicUrl)).arrayBuffer());
    const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
    if (videoBytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error('Vídeo maior que 500MB — reduza o tamanho do arquivo.');
    }

    const initRes = await fetch(`${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        ...youtubeHeaders(token),
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': media.mimeType,
        'X-Upload-Content-Length': String(videoBytes.byteLength),
      },
      body: JSON.stringify({
        snippet: { title: content.title.slice(0, 100), description: caption, categoryId: '22' },
        status: { privacyStatus: 'public' },
      }),
    });
    if (!initRes.ok) throw await youtubeApiError(initRes);
    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) throw new Error('O YouTube não retornou uma URL de upload.');

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': media.mimeType, 'Content-Length': String(videoBytes.byteLength) },
      body: videoBytes,
    });
    if (!uploadRes.ok) throw await youtubeApiError(uploadRes);
    const video = await uploadRes.json() as any;

    const externalPostId = video.id;
    const externalPostUrl = `https://www.youtube.com/watch?v=${externalPostId}`;

    await upsertContentPlatformStatus({ agencyId, contentId, platform: 'YOUTUBE', status: 'PUBLISHED', externalPostId, externalPostUrl, publishedAt: new Date() });

    return { success: true, externalPostId, externalPostUrl };
  } catch (err: any) {
    await upsertContentPlatformStatus({ agencyId, contentId, platform: 'YOUTUBE', status: 'FAILED', publishError: err.message }).catch(() => {});
    return { success: false, error: err.message || 'Erro ao publicar no YouTube.' };
  }
}

// ─── WHATSAPP (EVOLUTION API — self-hosted) ─────────────────────────────────
// Docs: https://doc.evolution-api.com — set EVOLUTION_API_URL / EVOLUTION_API_KEY in .env
//
// One connection PER AGENCY, not per client: the agency connects its own WhatsApp number once,
// and that same number sends creative previews to every client's phone for approval. Clients
// never connect their own WhatsApp here.
//
// NOTE: reads/writes to agency_whatsapp_settings go through raw SQL instead of a typed Prisma
// delegate — the table was added via a hand-applied migration while `prisma generate` couldn't
// reach binaries.prisma.sh from this machine. Switch to `prisma.agencyWhatsAppSettings.*` once
// `npx prisma generate` has been run somewhere with network access (e.g. the next Docker build).

interface AgencyWhatsAppRow {
  id: string;
  agency_id: string;
  instance_name: string;
  status: string;
  connected_number: string | null;
}

async function getWhatsAppSettingsRow(agencyId: string): Promise<AgencyWhatsAppRow | null> {
  const rows = await prisma.$queryRaw<AgencyWhatsAppRow[]>`
    SELECT id, agency_id, instance_name, status, connected_number
    FROM agency_whatsapp_settings WHERE agency_id = ${agencyId} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function upsertWhatsAppSettingsRow(agencyId: string, instanceName: string, status: string) {
  await prisma.$executeRaw`
    INSERT INTO agency_whatsapp_settings (id, agency_id, instance_name, status, updated_at)
    VALUES (gen_random_uuid()::text, ${agencyId}, ${instanceName}, ${status}, NOW())
    ON CONFLICT (agency_id) DO UPDATE
    SET instance_name = EXCLUDED.instance_name, status = EXCLUDED.status, updated_at = NOW()
  `;
}

async function updateWhatsAppStatusRow(agencyId: string, status: string, connectedNumber?: string | null) {
  await prisma.$executeRaw`
    UPDATE agency_whatsapp_settings
    SET status = ${status}, connected_number = COALESCE(${connectedNumber ?? null}, connected_number), updated_at = NOW()
    WHERE agency_id = ${agencyId}
  `;
}

async function deleteWhatsAppSettingsRow(agencyId: string) {
  await prisma.$executeRaw`DELETE FROM agency_whatsapp_settings WHERE agency_id = ${agencyId}`;
}

function instanceNameForAgency(agencyId: string) {
  return `agencyos-agency-${agencyId}`;
}

function evolutionHeaders() {
  return { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY || '' };
}

function assertEvolutionConfigured() {
  if (!process.env.EVOLUTION_API_URL) {
    throw new ValidationError('EVOLUTION_API_URL não configurado no servidor. Veja .env.example.');
  }
}

async function disconnectEvolutionInstance(instanceName: string) {
  await fetch(`${process.env.EVOLUTION_API_URL}/instance/logout/${instanceName}`, { method: 'DELETE', headers: evolutionHeaders() }).catch(() => {});
  await fetch(`${process.env.EVOLUTION_API_URL}/instance/delete/${instanceName}`, { method: 'DELETE', headers: evolutionHeaders() }).catch(() => {});
}

export async function getWhatsAppSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await getWhatsAppSettingsRow(req.user!.agencyId);
    if (!row) return res.json({ configured: false, status: 'DISCONNECTED' });
    res.json({ configured: row.status === 'ACTIVE', status: row.status, connectedNumber: row.connected_number });
  } catch (err) { next(err); }
}

export async function whatsappConnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertEvolutionConfigured();
    const agencyId = req.user!.agencyId;
    const instanceName = instanceNameForAgency(agencyId);

    const createRes = await fetch(`${process.env.EVOLUTION_API_URL}/instance/create`, {
      method: 'POST',
      headers: evolutionHeaders(),
      body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    });
    const createData = await createRes.json() as any;
    if (!createRes.ok) throw new Error(createData.message || createData.error || 'Failed to create WhatsApp instance');

    await upsertWhatsAppSettingsRow(agencyId, instanceName, 'PENDING');

    const qrcode = createData.qrcode?.base64 || createData.qrcode || null;
    res.json({ instanceName, qrcode, status: 'PENDING' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao conectar WhatsApp.' });
  }
}

export async function whatsappStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertEvolutionConfigured();
    const agencyId = req.user!.agencyId;
    const instanceName = instanceNameForAgency(agencyId);
    const stateRes = await fetch(`${process.env.EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
      headers: evolutionHeaders(),
    });
    const stateData = await stateRes.json() as any;
    const rawState = stateData.instance?.state || stateData.state || 'close';
    const status = rawState === 'open' ? 'ACTIVE' : rawState === 'connecting' ? 'PENDING' : 'DISCONNECTED';
    const connectedNumber = stateData.instance?.owner ? String(stateData.instance.owner).split('@')[0] : null;

    await updateWhatsAppStatusRow(agencyId, status, connectedNumber);

    res.json({ status, rawState, connectedNumber });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao verificar status do WhatsApp.' });
  }
}

export async function whatsappDisconnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertEvolutionConfigured();
    const agencyId = req.user!.agencyId;
    await disconnectEvolutionInstance(instanceNameForAgency(agencyId));
    await deleteWhatsAppSettingsRow(agencyId);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao desconectar WhatsApp.' });
  }
}

// Request-independent — reused by the approval-notification flow (approvalNotify.ts) to send
// the creative + caption + approval link as a WhatsApp message, the same way publishToMeta is
// reused by the scheduler. Sends FROM the agency's connected number TO the client's phone.
export async function sendWhatsAppMedia(params: {
  agencyId: string; phone: string; caption: string; mediaUrl?: string; mediaType?: 'image' | 'video';
}): Promise<{ success: boolean; error?: string }> {
  try {
    assertEvolutionConfigured();
    const instanceName = instanceNameForAgency(params.agencyId);
    const number = params.phone.replace(/\D/g, '');
    const endpoint = params.mediaUrl ? 'sendMedia' : 'sendText';
    const body = params.mediaUrl
      ? { number, mediatype: params.mediaType || 'image', media: params.mediaUrl, caption: params.caption }
      : { number, text: params.caption };

    const sendRes = await fetch(`${process.env.EVOLUTION_API_URL}/message/${endpoint}/${instanceName}`, {
      method: 'POST',
      headers: evolutionHeaders(),
      body: JSON.stringify(body),
    });
    const sendData = await sendRes.json() as any;
    if (!sendRes.ok) throw new Error(sendData.message || sendData.error || 'Failed to send WhatsApp message');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao enviar mensagem no WhatsApp.' };
  }
}

export async function whatsappSend(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertEvolutionConfigured();
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'phone e message são obrigatórios.' });
    }

    const instanceName = instanceNameForAgency(req.user!.agencyId);
    const sendRes = await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: evolutionHeaders(),
      body: JSON.stringify({ number: phone.replace(/\D/g, ''), text: message }),
    });
    const sendData = await sendRes.json() as any;
    if (!sendRes.ok) throw new Error(sendData.message || sendData.error || 'Failed to send WhatsApp message');

    res.json({ sent: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao enviar mensagem no WhatsApp.' });
  }
}

// Sends the finished creative straight to the CLIENT's own phone via the agency's connected
// WhatsApp — e.g. sharing the final piece for their records, not the approval-request flow
// (which sends a portal link instead and lives in approvals/approvalNotify.ts). Doesn't touch
// Content/ContentPlatform status — this is a private share, not a public platform publish.
export async function sendContentViaWhatsApp(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertEvolutionConfigured();
    const { contentId } = req.body;
    if (!contentId) return res.status(400).json({ error: 'contentId is required' });

    const content = await prisma.content.findFirst({
      where: { id: contentId, agencyId: req.user!.agencyId, deletedAt: null },
      include: {
        client: { select: { name: true, phone: true } },
        assets: { where: { role: 'PRIMARY' }, include: { asset: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
      },
    });
    if (!content) throw new NotFoundError('Content not found');
    if (!content.client.phone) {
      throw new ValidationError(`${content.client.name} não tem telefone cadastrado. Adicione um na ficha do cliente.`);
    }

    const media = content.assets[0]?.asset;
    const caption = [content.hook, content.caption, content.cta].filter(Boolean).join('\n\n') || content.title;

    const result = await sendWhatsAppMedia({
      agencyId: req.user!.agencyId, phone: content.client.phone, caption,
      mediaUrl: media?.publicUrl ?? undefined,
      mediaType: media?.mimeType?.startsWith('video/') ? 'video' : 'image',
    });
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ sent: true });
  } catch (err) { next(err); }
}

// ─── WHATSAPP STATUS (per-client, Evolution API) ────────────────────────────
// A real publishable network, distinct from the agency-level WhatsApp above (which sends the
// creative to the CLIENT'S OWN phone for approval, via the agency's connected number). This is
// the client's OWN WhatsApp Business number, already paired to an Evolution API instance
// managed outside this app — the agency just types in that instance's name here, no OAuth, no
// pairing flow. The connection is stored as a normal SocialConnection (platform: 'WHATSAPP',
// externalPageId: the instance name) so it plugs into the exact same listConnections/
// deleteConnection/scheduledPublisher machinery every other network already uses.
//
// Verified live against a real Evolution API instance: POST /message/sendStatus/{instance}
// with exactly the body shape below (type/content/backgroundColor/font/allContacts) returns
// 201 with a real status@broadcast message key — but it took ~23s for a plain text status on
// that server, not the sub-second response most of this app's other API calls assume. (There's
// also a publicly reported bug where this endpoint hangs with NO response at all in some
// Evolution versions — see EvolutionAPI/evolution-api#2377 — which is a different failure mode
// this timeout also guards against.) The timeout below is generous specifically because of
// that confirmed real-world latency, not a guess.

export async function connectClientWhatsApp(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertEvolutionConfigured();
    const { clientId, instanceName } = req.body;
    if (!clientId || !instanceName) return res.status(400).json({ error: 'clientId e instanceName são obrigatórios.' });

    const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: req.user!.agencyId } });
    if (!client) throw new NotFoundError('Client not found');

    const name = String(instanceName).trim();
    const stateRes = await fetch(`${process.env.EVOLUTION_API_URL}/instance/connectionState/${name}`, { headers: evolutionHeaders() });
    const stateData = await stateRes.json().catch(() => ({})) as any;
    const rawState = stateData.instance?.state || stateData.state;
    if (!stateRes.ok || rawState !== 'open') {
      return res.status(400).json({ error: `Instância "${name}" não encontrada ou não conectada. Confirme o nome exato e que o WhatsApp do cliente está pareado nessa instância.` });
    }

    const connection = await upsertConnection(
      { agencyId: req.user!.agencyId, clientId, platform: 'WHATSAPP', externalPageId: name },
      { accountName: name, status: 'ACTIVE', connectedBy: req.user!.id }
    );
    res.status(201).json(serializeConnection(connection));
  } catch (err) { next(err); }
}

// Sends a single Status update (text, or one image/video). Confirmed live this takes 20-76s+
// even for plain text — an image post additionally has Evolution fetch the file itself from
// our storage, which can run longer still — so the timeout has real margin above that, not a
// round number. It exists to guard against the documented sendStatus hang bug, not to fire on
// normal (if slow) latency.
async function sendOneWhatsAppStatus(instanceName: string, params: { type: 'text' | 'image' | 'video'; content: string; caption: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const statusRes = await fetch(`${process.env.EVOLUTION_API_URL}/message/sendStatus/${instanceName}`, {
      method: 'POST',
      headers: evolutionHeaders(),
      signal: controller.signal,
      body: JSON.stringify({ ...params, backgroundColor: '#075E54', font: 1, allContacts: true }),
    });
    if (!statusRes.ok) {
      const errData = await statusRes.json().catch(() => ({})) as any;
      throw new Error(errData.message || errData.error || 'Falha ao publicar no Status do WhatsApp.');
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('O envio para o Status do WhatsApp não respondeu a tempo — confirme se a instância do cliente está conectada.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function publishToWhatsAppStatus(params: {
  agencyId: string; contentId: string;
}): Promise<{ success: boolean; externalPostId?: string; externalPostUrl?: string; error?: string }> {
  const { agencyId, contentId } = params;
  // Declared outside the try block so the catch handler can report how far the loop below got
  // — each send that succeeds has ALREADY gone out for real, independent of what happens on a
  // later one, so if image 3 of 3 times out, images 1-2 are still live on the client's WhatsApp
  // even though this call reports failure overall. Without tracking this, the error message
  // would misleadingly imply nothing happened.
  let sentCount = 0;
  let totalCount = 0;
  try {
    assertEvolutionConfigured();
    const content = await prisma.content.findFirst({
      where: { id: contentId, agencyId, deletedAt: null },
      include: { assets: { where: { role: 'PRIMARY' }, include: { asset: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!content) throw new Error('Content not found');

    const connection = await prisma.socialConnection.findFirst({
      where: { agencyId, clientId: content.clientId, platform: 'WHATSAPP', status: 'ACTIVE' },
    });
    if (!connection?.externalPageId) {
      throw new Error('Nenhuma instância do WhatsApp conectada para este cliente.');
    }

    const mediaList = content.assets.map((a) => a.asset);
    const caption = [content.hook, content.caption, content.cta].filter(Boolean).join('\n\n');
    totalCount = Math.max(mediaList.length, 1);

    // WhatsApp Status has no native multi-image "post" — the closest real equivalent is several
    // Status updates posted back to back, same caption each time. Slow (each call is 20-76s+
    // even for plain text, confirmed live), so a carousel of N images can take several minutes
    // total; that's communicated in the UI's loading text.
    if (mediaList.length > 0) {
      for (const media of mediaList) {
        if (!media.publicUrl) throw new Error('Uma das mídias não tem URL pública disponível ainda. Tente novamente em instantes.');
        await sendOneWhatsAppStatus(connection.externalPageId, {
          type: media.mimeType.startsWith('video/') ? 'video' : 'image',
          content: media.publicUrl,
          caption,
        });
        sentCount++;
      }
    } else {
      await sendOneWhatsAppStatus(connection.externalPageId, { type: 'text', content: caption || content.title, caption });
      sentCount++;
    }

    await upsertContentPlatformStatus({ agencyId, contentId, platform: 'WHATSAPP', status: 'PUBLISHED', publishedAt: new Date() });

    return { success: true };
  } catch (err: any) {
    const baseMessage = err.message || 'Erro ao publicar no Status do WhatsApp.';
    const message = sentCount > 0 && sentCount < totalCount
      ? `${sentCount} de ${totalCount} imagens foram publicadas antes de falhar — ${baseMessage}`
      : baseMessage;
    await upsertContentPlatformStatus({ agencyId, contentId, platform: 'WHATSAPP', status: 'FAILED', publishError: message }).catch(() => {});
    return { success: false, error: message };
  }
}

// ─── PUBLISH (FACEBOOK / INSTAGRAM) ─────────────────────────────────────────
//
// `publishToMeta` is the request-independent core — used by the manual "Publicar" button
// (via the `publishContent` HTTP handler below) AND by the scheduled publisher
// (see jobs/scheduledPublisher.ts), which has no req/res to work with.

// Instagram processes video containers (Reels/Stories) asynchronously — calling media_publish
// before status_code reaches FINISHED fails. Polls every 3s, up to ~2 minutes (short-form
// marketing video should finish well within that; a slower upload just fails cleanly after).
async function waitForIgContainerReady(containerId: string, accessToken: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await fetch(`${GRAPH_URL}/${containerId}?fields=status_code&access_token=${accessToken}`);
    const data = await res.json() as any;
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('O processamento do vídeo falhou no Instagram.');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('O vídeo demorou demais para processar no Instagram. Tente novamente em alguns minutos.');
}

export async function publishToMeta(params: {
  agencyId: string; contentId: string; platform: 'FACEBOOK' | 'INSTAGRAM' | 'INSTAGRAM_STORY';
}): Promise<{ success: boolean; externalPostId?: string; externalPostUrl?: string; error?: string }> {
  const { agencyId, contentId, platform } = params;
  // Instagram Stories publish through the same IG Business Account connection as regular feed
  // posts — there's no separate "story connection" to manage, just a different Graph API call.
  const connectionPlatform = platform === 'INSTAGRAM_STORY' ? 'INSTAGRAM' : platform;
  try {
    const content = await prisma.content.findFirst({
      where: { id: contentId, agencyId, deletedAt: null },
      include: { assets: { where: { role: 'PRIMARY' }, include: { asset: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!content) throw new Error('Content not found');

    const connection = await prisma.socialConnection.findFirst({
      where: { agencyId, clientId: content.clientId, platform: connectionPlatform, status: 'ACTIVE' },
    });
    if (!connection || !connection.accessTokenEncrypted) {
      throw new Error(`Nenhuma conta ${connectionPlatform === 'FACEBOOK' ? 'do Facebook' : 'do Instagram'} conectada para este cliente.`);
    }

    // Carousel support (2+ images, in the order the agency set): FACEBOOK stages each photo
    // unpublished then attaches them all to one feed post; INSTAGRAM builds a child container
    // per image then a parent CAROUSEL container. Stories and video posts are always single-
    // media — carousels don't apply. content.contentType === 'CAROUSEL' is what put multiple
    // PRIMARY assets here in the first place (see setContentPrimaryAssets).
    const mediaList = content.assets.map((a) => a.asset);
    const media = mediaList[0];
    const isVideo = !!media?.mimeType?.startsWith('video/');
    const isImageCarousel = platform !== 'INSTAGRAM_STORY' && mediaList.length > 1 && mediaList.every((m) => !m.mimeType.startsWith('video/'));
    const pageToken = decrypt(connection.accessTokenEncrypted);
    const caption = [content.hook, content.caption, content.cta].filter(Boolean).join('\n\n');

    let externalPostId: string;
    let externalPostUrl: string | undefined;

    if (platform === 'FACEBOOK') {
      if (isImageCarousel) {
        const mediaFbids: string[] = [];
        for (const m of mediaList) {
          const stageRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: m.publicUrl, published: false, access_token: pageToken }),
          });
          const stageData = await stageRes.json() as any;
          if (!stageRes.ok) throw new Error(stageData.error?.message || 'Falha ao preparar uma das fotos do carrossel no Facebook');
          mediaFbids.push(stageData.id);
        }
        const publishRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: caption, attached_media: mediaFbids.map((id) => ({ media_fbid: id })), access_token: pageToken }),
        });
        const publishData = await publishRes.json() as any;
        if (!publishRes.ok) throw new Error(publishData.error?.message || 'Falha ao publicar carrossel no Facebook');
        externalPostId = publishData.id;
      } else if (media && isVideo) {
        const publishRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_url: media.publicUrl, description: caption, access_token: pageToken }),
        });
        const publishData = await publishRes.json() as any;
        if (!publishRes.ok) throw new Error(publishData.error?.message || 'Falha ao publicar vídeo no Facebook');
        externalPostId = publishData.id;
      } else if (media) {
        const publishRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: media.publicUrl, caption, access_token: pageToken }),
        });
        const publishData = await publishRes.json() as any;
        if (!publishRes.ok) throw new Error(publishData.error?.message || 'Falha ao publicar no Facebook');
        externalPostId = publishData.post_id || publishData.id;
      } else {
        const publishRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: caption, access_token: pageToken }),
        });
        const publishData = await publishRes.json() as any;
        if (!publishRes.ok) throw new Error(publishData.error?.message || 'Falha ao publicar no Facebook');
        externalPostId = publishData.id;
      }
      externalPostUrl = `https://www.facebook.com/${externalPostId}`;
    } else if (platform === 'INSTAGRAM_STORY') {
      if (!media) throw new Error('Stories exigem uma imagem ou vídeo — gere ou envie um criativo primeiro.');

      // Stories don't support a caption/text overlay via the Graph API — any text needs to
      // already be baked into the media itself (unlike feed posts, which take `caption`).
      const containerRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isVideo
            ? { video_url: media.publicUrl, media_type: 'STORIES', access_token: pageToken }
            : { image_url: media.publicUrl, media_type: 'STORIES', access_token: pageToken }
        ),
      });
      const containerData = await containerRes.json() as any;
      if (!containerRes.ok) throw new Error(containerData.error?.message || 'Falha ao preparar o Story');

      // Video containers process asynchronously on Meta's side — publishing before they're
      // ready fails, so poll status_code until FINISHED (images are ready immediately).
      if (isVideo) await waitForIgContainerReady(containerData.id, pageToken);

      const publishRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerData.id, access_token: pageToken }),
      });
      const publishData = await publishRes.json() as any;
      if (!publishRes.ok) throw new Error(publishData.error?.message || 'Falha ao publicar o Story');
      externalPostId = publishData.id;
    } else {
      if (!media) throw new Error('Instagram exige uma imagem ou vídeo — gere ou envie um criativo primeiro.');

      if (isImageCarousel) {
        const childIds: string[] = [];
        for (const m of mediaList) {
          const childRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: m.publicUrl, is_carousel_item: true, access_token: pageToken }),
          });
          const childData = await childRes.json() as any;
          if (!childRes.ok) throw new Error(childData.error?.message || 'Falha ao preparar uma das imagens do carrossel no Instagram');
          childIds.push(childData.id);
        }
        const parentRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_type: 'CAROUSEL', children: childIds.join(','), caption, access_token: pageToken }),
        });
        const parentData = await parentRes.json() as any;
        if (!parentRes.ok) throw new Error(parentData.error?.message || 'Falha ao preparar o carrossel no Instagram');

        const publishRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/media_publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creation_id: parentData.id, access_token: pageToken }),
        });
        const publishData = await publishRes.json() as any;
        if (!publishRes.ok) throw new Error(publishData.error?.message || 'Falha ao publicar o carrossel no Instagram');
        externalPostId = publishData.id;
        // isVideo/waitForIgContainerReady/single-container publish below only apply to the
        // single-media path — skip straight to recording the result.
        await upsertContentPlatformStatus({ agencyId, contentId, platform, status: 'PUBLISHED', externalPostId, publishedAt: new Date() });
        return { success: true, externalPostId };
      }

      const containerRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isVideo
            ? { video_url: media.publicUrl, media_type: 'REELS', caption, access_token: pageToken }
            : { image_url: media.publicUrl, caption, access_token: pageToken }
        ),
      });
      const containerData = await containerRes.json() as any;
      if (!containerRes.ok) throw new Error(containerData.error?.message || 'Falha ao preparar publicação no Instagram');

      if (isVideo) await waitForIgContainerReady(containerData.id, pageToken);

      const publishRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerData.id, access_token: pageToken }),
      });
      const publishData = await publishRes.json() as any;
      if (!publishRes.ok) throw new Error(publishData.error?.message || 'Falha ao publicar no Instagram');
      externalPostId = publishData.id;
    }

    await upsertContentPlatformStatus({ agencyId, contentId, platform, status: 'PUBLISHED', externalPostId, externalPostUrl, publishedAt: new Date() });

    return { success: true, externalPostId, externalPostUrl };
  } catch (err: any) {
    await upsertContentPlatformStatus({ agencyId, contentId, platform, status: 'FAILED', publishError: err.message }).catch(() => {});
    return { success: false, error: err.message || 'Erro ao publicar conteúdo.' };
  }
}

export async function publishContent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId, platform } = req.body;
    if (!contentId || !platform || !['FACEBOOK', 'INSTAGRAM', 'INSTAGRAM_STORY', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'WHATSAPP'].includes(platform)) {
      return res.status(400).json({ error: 'contentId e platform (FACEBOOK, INSTAGRAM, INSTAGRAM_STORY, LINKEDIN, TIKTOK, YOUTUBE ou WHATSAPP) são obrigatórios.' });
    }

    const result = platform === 'LINKEDIN'
      ? await publishToLinkedIn({ agencyId: req.user!.agencyId, contentId })
      : platform === 'TIKTOK'
      ? await publishToTikTok({ agencyId: req.user!.agencyId, contentId })
      : platform === 'YOUTUBE'
      ? await publishToYouTube({ agencyId: req.user!.agencyId, contentId })
      : platform === 'WHATSAPP'
      ? await publishToWhatsAppStatus({ agencyId: req.user!.agencyId, contentId })
      : await publishToMeta({ agencyId: req.user!.agencyId, contentId, platform });
    if (!result.success) return res.status(400).json({ error: result.error });

    await prisma.content.update({ where: { id: contentId }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    res.json({ published: true, externalPostId: result.externalPostId, externalPostUrl: result.externalPostUrl });
  } catch (err) { next(err); }
}
