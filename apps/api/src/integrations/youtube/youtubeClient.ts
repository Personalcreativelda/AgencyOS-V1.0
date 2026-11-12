// Shared YouTube (Data API v3, Google OAuth 2.0) helpers — mirrors integrations/meta/metaClient.ts,
// integrations/linkedin/linkedinClient.ts and integrations/tiktok/tiktokClient.ts. Each agency
// registers its own Google Cloud project (console.cloud.google.com), same "bring your own App"
// model already used for the others.
//
// Endpoint paths and OAuth mechanics below were verified directly against
// developers.google.com before writing this. The one Google-specific thing to keep in mind
// throughout this module: access tokens last only ~1h (shorter than Meta/LinkedIn/TikTok), and
// a refresh_token is only ever issued if the authorization request included
// `access_type=offline` (see tiktokConnect-equivalent in social.controller.ts) — without it,
// the connection silently stops working after an hour with no way to recover except reconnecting.

import { prisma } from '../../database/prisma';
import { decrypt } from '../../common/crypto';
import { YouTubeApiError } from '../../common/middleware/errorHandler';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';

// Derived from APP_URL rather than its own env var — see the equivalent note in metaClient.ts.
export function buildYouTubeRedirectUri(path: string) {
  return `${process.env.APP_URL || 'http://localhost:5173'}${path}`;
}

// NOTE: reads/writes to youtube_client_id/youtube_client_secret_encrypted go through raw SQL
// instead of the typed Prisma delegate — same reason as the LinkedIn/TikTok fields: the columns
// were added via a hand-applied migration while Docker (the only working path to regenerate the
// Prisma Client here) wasn't reachable. Switch to `prisma.agencySocialSettings.*` once
// `npx prisma generate` has run somewhere with network access (e.g. the next Docker build).
export async function getAgencyYouTubeCredentials(agencyId: string) {
  const rows = await prisma.$queryRaw<{ youtube_client_id: string | null; youtube_client_secret_encrypted: string | null }[]>`
    SELECT youtube_client_id, youtube_client_secret_encrypted FROM agency_social_settings WHERE agency_id = ${agencyId} LIMIT 1
  `;
  const row = rows[0];
  if (!row?.youtube_client_id || !row.youtube_client_secret_encrypted) return null;
  return { clientId: row.youtube_client_id, clientSecret: decrypt(row.youtube_client_secret_encrypted) };
}

interface GoogleTokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string; // only present on the initial authorization_code exchange, not on refresh
}

async function requestGoogleToken(credentials: { clientId: string; clientSecret: string }, params: Record<string, string>): Promise<GoogleTokenResponse> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, ...params }).toString(),
  });
  const data = await tokenRes.json() as any;
  if (!tokenRes.ok) throw new Error(data.error_description || data.error || 'Failed to exchange Google token');
  return { accessToken: data.access_token, expiresIn: data.expires_in, refreshToken: data.refresh_token };
}

export async function exchangeYouTubeCode(
  credentials: { clientId: string; clientSecret: string },
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse & { refreshToken: string }> {
  const result = await requestGoogleToken(credentials, { code, grant_type: 'authorization_code', redirect_uri: redirectUri });
  if (!result.refreshToken) {
    throw new Error('O Google não retornou um refresh token, reconecte garantindo que a tela de consentimento está pedindo acesso offline.');
  }
  return result as GoogleTokenResponse & { refreshToken: string };
}

// Google access tokens last only ~1h — shorter than Meta/LinkedIn/TikTok — so real use requires
// actually calling this before any publish whose token might be stale. Unlike TikTok, Google
// normally does NOT re-issue a new refresh_token on this call — the original one keeps working.
export async function refreshYouTubeToken(
  credentials: { clientId: string; clientSecret: string },
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const result = await requestGoogleToken(credentials, { grant_type: 'refresh_token', refresh_token: refreshToken });
  return { accessToken: result.accessToken, expiresIn: result.expiresIn };
}

export function youtubeHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// Turns a failed YouTube Data API response into a curated, user-safe YouTubeApiError — same
// idea as metaApiError/linkedInApiError/tiktokApiError.
export async function youtubeApiError(response: Response): Promise<YouTubeApiError> {
  try {
    const body = await response.json() as any;
    const msg = body?.error?.message;
    if (typeof msg === 'string' && msg.trim()) return new YouTubeApiError(`YouTube: ${msg}`);
  } catch {
    // Not JSON — fall through to the generic message below.
  }
  return new YouTubeApiError('O YouTube não conseguiu processar a solicitação. Verifique a conexão da conta.');
}
