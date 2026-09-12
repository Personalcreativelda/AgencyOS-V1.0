// Shared TikTok (Content Posting API, OAuth 2.0) helpers — mirrors integrations/meta/metaClient.ts
// and integrations/linkedin/linkedinClient.ts. Each agency registers its own TikTok App
// (developers.tiktok.com), same "bring your own App" model already used for Meta/LinkedIn.
//
// Exact endpoint paths, parameter names (`client_key`, not `client_id`), and response shapes
// below were verified directly against developers.tiktok.com before writing this — TikTok's API
// has enough quirks (24h access tokens vs Meta/LinkedIn's ~60 days, `client_key` naming, video
// FILE_UPLOAD vs photo PULL_FROM_URL-only) that guessing from memory would have been risky.

import { prisma } from '../../database/prisma';
import { decrypt } from '../../common/crypto';
import { TikTokApiError } from '../../common/middleware/errorHandler';

export const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
export const TIKTOK_API_URL = 'https://open.tiktokapis.com';

// Derived from APP_URL rather than its own env var — see the equivalent note in metaClient.ts.
export function buildTikTokRedirectUri(path: string) {
  return `${process.env.APP_URL || 'http://localhost:5173'}${path}`;
}

// NOTE: reads/writes to tiktok_client_key/tiktok_client_secret_encrypted go through raw SQL
// instead of the typed Prisma delegate — same reason as linkedin_client_id in
// social.controller.ts: the columns were added via a hand-applied migration while Docker (the
// only working path to regenerate the Prisma Client here) wasn't reachable. Switch to
// `prisma.agencySocialSettings.*` once `npx prisma generate` has run somewhere with network
// access (e.g. the next Docker build).
export async function getAgencyTikTokCredentials(agencyId: string) {
  const rows = await prisma.$queryRaw<{ tiktok_client_key: string | null; tiktok_client_secret_encrypted: string | null }[]>`
    SELECT tiktok_client_key, tiktok_client_secret_encrypted FROM agency_social_settings WHERE agency_id = ${agencyId} LIMIT 1
  `;
  const row = rows[0];
  if (!row?.tiktok_client_key || !row.tiktok_client_secret_encrypted) return null;
  return { clientKey: row.tiktok_client_key, clientSecret: decrypt(row.tiktok_client_secret_encrypted) };
}

interface TikTokTokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  openId: string;
}

async function requestTikTokToken(credentials: { clientKey: string; clientSecret: string }, params: Record<string, string>): Promise<TikTokTokenResponse> {
  const tokenRes = await fetch(`${TIKTOK_API_URL}/v2/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: credentials.clientKey, client_secret: credentials.clientSecret, ...params }).toString(),
  });
  const data = await tokenRes.json() as any;
  if (!tokenRes.ok || data.error) throw new Error(data.error_description || data.message || 'Failed to exchange TikTok token');
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
    refreshExpiresIn: data.refresh_expires_in,
    openId: data.open_id,
  };
}

export async function exchangeTikTokCode(
  credentials: { clientKey: string; clientSecret: string },
  code: string,
  redirectUri: string
): Promise<TikTokTokenResponse> {
  return requestTikTokToken(credentials, { code, grant_type: 'authorization_code', redirect_uri: redirectUri });
}

// TikTok access tokens last only 24h (refresh_token lasts 365 days) — unlike Meta/LinkedIn,
// real use requires actually calling this before every publish whose token might be stale.
export async function refreshTikTokToken(
  credentials: { clientKey: string; clientSecret: string },
  refreshToken: string
): Promise<TikTokTokenResponse> {
  return requestTikTokToken(credentials, { grant_type: 'refresh_token', refresh_token: refreshToken });
}

export function tiktokHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' };
}

// Turns a failed TikTok API response into a curated, user-safe TikTokApiError — same idea as
// metaApiError/linkedInApiError.
export async function tiktokApiError(response: Response): Promise<TikTokApiError> {
  try {
    const body = await response.json() as any;
    const msg = body?.error?.message;
    if (typeof msg === 'string' && msg.trim()) return new TikTokApiError(`TikTok: ${msg}`);
  } catch {
    // Not JSON — fall through to the generic message below.
  }
  return new TikTokApiError('O TikTok não conseguiu processar a solicitação. Verifique a conexão da conta.');
}
