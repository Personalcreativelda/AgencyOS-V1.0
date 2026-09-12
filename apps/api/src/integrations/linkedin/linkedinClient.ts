// Shared LinkedIn (REST API, OAuth 2.0) helpers — mirrors integrations/meta/metaClient.ts.
// Each agency registers its own LinkedIn App (linkedin.com/developers), same "bring your own
// App" model already used for Meta, so connections aren't tied to one shared app for the whole
// SaaS.

import { prisma } from '../../database/prisma';
import { decrypt } from '../../common/crypto';
import { LinkedInApiError } from '../../common/middleware/errorHandler';

// LinkedIn versions its REST API via a header (YYYYMM), not the URL. Override via env if
// LinkedIn deprecates this version — see apps/api/.env.example.
export const LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION || '202401';
export const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2';
export const LINKEDIN_API_URL = 'https://api.linkedin.com';

// Derived from APP_URL rather than its own env var — see the equivalent note in metaClient.ts.
export function buildLinkedInRedirectUri(path: string) {
  return `${process.env.APP_URL || 'http://localhost:5173'}${path}`;
}

// NOTE: reads/writes to linkedin_client_id/linkedin_client_secret_encrypted go through raw SQL
// instead of the typed Prisma delegate — same reason as agency_whatsapp_settings in
// social.controller.ts: the columns were added via a hand-applied migration while Docker (the
// only working path to regenerate the Prisma Client in this environment) wasn't reachable.
// The Prisma Client validates args against its generated schema at RUNTIME, so even an `as any`
// cast doesn't help — it rejects "unknown argument" before the query is ever sent. Switch to
// `prisma.agencySocialSettings.*` once `npx prisma generate` has run somewhere with network
// access (e.g. the next Docker build).
export async function getAgencyLinkedInCredentials(agencyId: string) {
  const rows = await prisma.$queryRaw<{ linkedin_client_id: string | null; linkedin_client_secret_encrypted: string | null }[]>`
    SELECT linkedin_client_id, linkedin_client_secret_encrypted FROM agency_social_settings WHERE agency_id = ${agencyId} LIMIT 1
  `;
  const row = rows[0];
  if (!row?.linkedin_client_id || !row.linkedin_client_secret_encrypted) return null;
  return { clientId: row.linkedin_client_id, clientSecret: decrypt(row.linkedin_client_secret_encrypted) };
}

// Exchanges an OAuth `code` for an access token. Unlike Meta, LinkedIn's token isn't extended
// in a second step — `expiresIn` (seconds, typically ~60 days) is returned directly.
export async function exchangeLinkedInCode(
  credentials: { clientId: string; clientSecret: string },
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const tokenRes = await fetch(`${LINKEDIN_AUTH_URL}/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }).toString(),
  });
  const tokenData = await tokenRes.json() as any;
  if (!tokenRes.ok) throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange LinkedIn code');
  return { accessToken: tokenData.access_token, expiresIn: tokenData.expires_in };
}

export function linkedInHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': LINKEDIN_API_VERSION,
    'Content-Type': 'application/json',
  };
}

// Turns a failed LinkedIn API response into a curated, user-safe LinkedInApiError — same idea
// as metaApiError.
export async function linkedInApiError(response: Response): Promise<LinkedInApiError> {
  try {
    const body = await response.json() as any;
    const msg = body?.message;
    if (typeof msg === 'string' && msg.trim()) return new LinkedInApiError(`LinkedIn: ${msg}`);
  } catch {
    // Not JSON — fall through to the generic message below.
  }
  return new LinkedInApiError('O LinkedIn não conseguiu processar a solicitação. Verifique a conexão da conta.');
}
