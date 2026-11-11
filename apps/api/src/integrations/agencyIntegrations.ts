import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/middleware/auth';
import { prisma } from '../database/prisma';
import { ValidationError } from '../common/middleware/errorHandler';
import { encrypt, decrypt, maskSecret } from '../common/crypto';

// ─── Per-agency integration credentials configured from the dashboard ─────────────────────
// AgencyOS is multi-tenant: every agency brings its own WhatsApp (Evolution API) server and
// TikTok Ads app, set in Redes sociais › Agência. Server env vars are only a fallback for the
// developer's own deployment — agencies never see or edit them.
//
// Production deploys don't run `prisma migrate deploy` automatically (see DEPLOY.md), so the
// columns are created idempotently on first use. The matching migration file uses the same
// IF NOT EXISTS statements, so running it later is harmless.

let columnsReady: Promise<void> | null = null;
export function ensureIntegrationColumns() {
  if (!columnsReady) {
    columnsReady = (async () => {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE agency_social_settings
          ADD COLUMN IF NOT EXISTS evolution_api_url TEXT,
          ADD COLUMN IF NOT EXISTS evolution_api_key_encrypted TEXT,
          ADD COLUMN IF NOT EXISTS tiktok_ads_app_id TEXT,
          ADD COLUMN IF NOT EXISTS tiktok_ads_app_secret_encrypted TEXT
      `);
    })().catch((err) => {
      columnsReady = null; // retry on the next call instead of caching the failure
      throw err;
    });
  }
  return columnsReady;
}

type Row = {
  evolution_api_url: string | null;
  evolution_api_key_encrypted: string | null;
  tiktok_ads_app_id: string | null;
  tiktok_ads_app_secret_encrypted: string | null;
};

async function readRow(agencyId: string): Promise<Row | undefined> {
  await ensureIntegrationColumns();
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT evolution_api_url, evolution_api_key_encrypted, tiktok_ads_app_id, tiktok_ads_app_secret_encrypted
    FROM agency_social_settings WHERE agency_id = ${agencyId} LIMIT 1
  `;
  return rows[0];
}

/** Creates the agency's settings row if missing, then runs the column update. */
async function upsertColumns(agencyId: string, set: Partial<Row>) {
  await ensureIntegrationColumns();
  await prisma.$executeRaw`
    INSERT INTO agency_social_settings (id, agency_id, created_at, updated_at)
    VALUES (gen_random_uuid()::text, ${agencyId}, NOW(), NOW())
    ON CONFLICT (agency_id) DO NOTHING
  `;
  const keys = Object.keys(set) as (keyof Row)[];
  for (const key of keys) {
    // Column names come from the fixed Row type above, never from user input.
    await prisma.$executeRawUnsafe(
      `UPDATE agency_social_settings SET ${key} = $1, updated_at = NOW() WHERE agency_id = $2`,
      set[key] ?? null,
      agencyId,
    );
  }
}

const cleanUrl = (value: string) => value.trim().replace(/\/+$/, '');

// ─── Evolution API (WhatsApp) ──────────────────────────────────────────────────────────────

export type EvolutionConfig = { url: string; headers: Record<string, string>; source: 'agency' | 'server' };

export async function getEvolutionConfig(agencyId: string): Promise<EvolutionConfig | null> {
  const row = await readRow(agencyId).catch(() => undefined);
  if (row?.evolution_api_url && row.evolution_api_key_encrypted) {
    return {
      url: cleanUrl(row.evolution_api_url),
      headers: { 'Content-Type': 'application/json', apikey: decrypt(row.evolution_api_key_encrypted) },
      source: 'agency',
    };
  }
  if (process.env.EVOLUTION_API_URL) {
    return {
      url: cleanUrl(process.env.EVOLUTION_API_URL),
      headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY || '' },
      source: 'server',
    };
  }
  return null;
}

export async function requireEvolutionConfig(agencyId: string): Promise<EvolutionConfig> {
  const config = await getEvolutionConfig(agencyId);
  if (!config) {
    throw new ValidationError('Configure o servidor do WhatsApp (Evolution API) em Redes sociais › Agência antes de usar o WhatsApp.');
  }
  return config;
}

export async function getEvolutionSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await readRow(req.user!.agencyId);
    if (!row?.evolution_api_url || !row.evolution_api_key_encrypted) {
      return res.json({ configured: false, serverDefault: !!process.env.EVOLUTION_API_URL });
    }
    res.json({
      configured: true,
      evolutionApiUrl: row.evolution_api_url,
      evolutionApiKeyMasked: maskSecret(decrypt(row.evolution_api_key_encrypted)),
    });
  } catch (err) { next(err); }
}

export async function saveEvolutionSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const url = cleanUrl(String(req.body.evolutionApiUrl || ''));
    const key = String(req.body.evolutionApiKey || '').trim();
    if (!/^https?:\/\/.+/i.test(url) || !key) {
      throw new ValidationError('Informe a URL (https://…) e a API Key do seu servidor Evolution API.');
    }

    // Validate before saving, so a typo is caught here instead of when a client approval fails.
    let ok = false;
    try {
      const probe = await fetch(`${url}/instance/fetchInstances`, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
      ok = probe.ok;
      if (probe.status === 401 || probe.status === 403) throw new ValidationError('A Evolution API recusou a API Key. Confira a chave global (AUTHENTICATION_API_KEY).');
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError('Não foi possível contactar esse servidor. Confira a URL e se ele está online.');
    }
    if (!ok) throw new ValidationError('O servidor respondeu, mas não parece ser uma Evolution API. Confira a URL.');

    await upsertColumns(req.user!.agencyId, { evolution_api_url: url, evolution_api_key_encrypted: encrypt(key) });
    res.json({ configured: true, evolutionApiUrl: url, evolutionApiKeyMasked: maskSecret(key) });
  } catch (err) { next(err); }
}

export async function deleteEvolutionSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await upsertColumns(req.user!.agencyId, { evolution_api_url: null, evolution_api_key_encrypted: null });
    res.json({ configured: false, serverDefault: !!process.env.EVOLUTION_API_URL });
  } catch (err) { next(err); }
}

// ─── TikTok Ads (Marketing API app — different from the TikTok publishing app) ─────────────

export async function getTikTokAdsCredentials(agencyId: string): Promise<{ id: string; secret: string } | null> {
  const row = await readRow(agencyId).catch(() => undefined);
  if (row?.tiktok_ads_app_id && row.tiktok_ads_app_secret_encrypted) {
    return { id: row.tiktok_ads_app_id, secret: decrypt(row.tiktok_ads_app_secret_encrypted) };
  }
  const id = process.env.TIKTOK_ADS_APP_ID;
  const secret = process.env.TIKTOK_ADS_APP_SECRET;
  return id && secret ? { id, secret } : null;
}

export async function getTikTokAdsSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const row = await readRow(req.user!.agencyId);
    if (!row?.tiktok_ads_app_id || !row.tiktok_ads_app_secret_encrypted) {
      return res.json({ configured: false, serverDefault: !!(process.env.TIKTOK_ADS_APP_ID && process.env.TIKTOK_ADS_APP_SECRET) });
    }
    res.json({
      configured: true,
      tiktokAdsAppId: row.tiktok_ads_app_id,
      tiktokAdsAppSecretMasked: maskSecret(decrypt(row.tiktok_ads_app_secret_encrypted)),
    });
  } catch (err) { next(err); }
}

export async function saveTikTokAdsSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = String(req.body.tiktokAdsAppId || '').trim();
    const secret = String(req.body.tiktokAdsAppSecret || '').trim();
    if (!id || !secret) throw new ValidationError('Informe o App ID e o Secret do seu app no TikTok for Business.');
    await upsertColumns(req.user!.agencyId, { tiktok_ads_app_id: id, tiktok_ads_app_secret_encrypted: encrypt(secret) });
    res.json({ configured: true, tiktokAdsAppId: id, tiktokAdsAppSecretMasked: maskSecret(secret) });
  } catch (err) { next(err); }
}

export async function deleteTikTokAdsSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await upsertColumns(req.user!.agencyId, { tiktok_ads_app_id: null, tiktok_ads_app_secret_encrypted: null });
    res.json({ configured: false });
  } catch (err) { next(err); }
}
