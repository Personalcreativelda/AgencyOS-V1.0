// Shared Meta (Facebook/Instagram Graph API + Marketing API) helpers — used by both the organic
// social module (Pages/Instagram publishing) and the Ads module (ad accounts/campaigns). Both
// ride the same "bring your own Meta App" credentials and OAuth code→token exchange; this file
// is the one place that logic lives so it isn't duplicated between the two modules.

import { prisma } from '../../database/prisma';
import { decrypt } from '../../common/crypto';
import { MetaApiError } from '../../common/middleware/errorHandler';

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v19.0';
export const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Derived from APP_URL rather than its own env var — see the equivalent note in
// social.controller.ts. `path` is the module-specific callback route (each module has its own
// callback endpoint since they request different OAuth scopes).
export function buildMetaRedirectUri(path: string) {
  return `${process.env.APP_URL || 'http://localhost:5173'}${path}`;
}

export async function getAgencyMetaCredentials(agencyId: string) {
  const settings = await prisma.agencySocialSettings.findUnique({ where: { agencyId } });
  if (!settings?.metaAppId || !settings.metaAppSecretEncrypted) return null;
  return { appId: settings.metaAppId, appSecret: decrypt(settings.metaAppSecretEncrypted) };
}

// Exchanges an OAuth `code` for a short-lived user token, then immediately extends it to a
// long-lived one (the standard two-step Meta flow) — returns whichever succeeded, preferring
// the long-lived token.
export async function exchangeCodeForLongLivedToken(
  credentials: { appId: string; appSecret: string },
  code: string,
  redirectUri: string
): Promise<string> {
  const tokenRes = await fetch(`${GRAPH_URL}/oauth/access_token?` + new URLSearchParams({
    client_id: credentials.appId,
    client_secret: credentials.appSecret,
    redirect_uri: redirectUri,
    code,
  }));
  const tokenData = await tokenRes.json() as any;
  if (!tokenRes.ok) throw new Error(tokenData.error?.message || 'Failed to exchange Meta code');

  const longLivedRes = await fetch(`${GRAPH_URL}/oauth/access_token?` + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: credentials.appId,
    client_secret: credentials.appSecret,
    fb_exchange_token: tokenData.access_token,
  }));
  const longLivedData = await longLivedRes.json() as any;
  return longLivedData.access_token || tokenData.access_token;
}

// Turns a failed Graph/Marketing API response body into a curated, user-safe MetaApiError —
// Meta's own error messages (e.g. "(#200) Missing ads_management permission") are already
// meant to be read by whoever holds the token, so it's fine for these to reach the agency
// instead of being flattened into a generic 500.
export async function metaApiError(response: Response): Promise<MetaApiError> {
  try {
    const body = await response.json() as any;
    const msg = body?.error?.error_user_msg || body?.error?.message;
    if (typeof msg === 'string' && msg.trim()) return new MetaApiError(`Meta: ${msg}`);
  } catch {
    // Not JSON — fall through to the generic message below.
  }
  return new MetaApiError('A Meta não conseguiu processar a solicitação. Verifique a conexão da conta de anúncios.');
}
