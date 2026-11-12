// "Continuar com Google" on the login screen.
//
// Login happens before we know the agency, so this uses the platform's own Google OAuth client
// (GOOGLE_LOGIN_CLIENT_ID / GOOGLE_LOGIN_CLIENT_SECRET, falling back to GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET) — unlike YouTube / Google Ads, which use each agency's own app.
//
// Flow (works in the browser and in the Android app, where Google blocks sign-in inside WebViews):
//   1. GET  /auth/google/start?app=1  → redirect to Google (opened in the system browser on Android)
//   2. GET  /auth/google/callback     → Google returns here; we match the verified e-mail to an
//      existing user and hand back a one-time code (web: /login?google_code=…, app: agencyos://login?google_code=…)
//   3. POST /auth/google/exchange     → the login page trades that code for the normal session.
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma';
import { issueSession } from './auth.service';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALLBACK = '/api/v1/auth/google/callback';
const CODE_TTL = 2 * 60 * 1000;

const oneTimeCodes = new Map<string, { userId: string; expiresAt: number }>();

const appUrl = () => process.env.APP_URL || 'http://localhost:5173';

function credentials() {
  const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_LOGIN_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function stateKey() {
  return process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev_secret';
}

function signState(value: { app: boolean; expiresAt: number }) {
  const payload = Buffer.from(JSON.stringify({ ...value, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  const sig = crypto.createHmac('sha256', stateKey()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function readState(state: string): { app: boolean } | null {
  const [payload, supplied] = String(state || '').split('.');
  if (!payload || !supplied) return null;
  const expected = crypto.createHmac('sha256', stateKey()).update(payload).digest();
  const given = Buffer.from(supplied, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.expiresAt > Date.now() ? { app: !!data.app } : null;
  } catch { return null; }
}

function finish(res: Response, app: boolean, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  res.redirect(app ? `agencyos://login?${query}` : `${appUrl()}/login?${query}`);
}

export function googleLoginStatus(_req: Request, res: Response) {
  res.json({ enabled: !!credentials() });
}

export function googleLoginStart(req: Request, res: Response) {
  const creds = credentials();
  const app = req.query.app === '1';
  if (!creds) return finish(res, app, { google_error: 'indisponivel' });
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: `${appUrl()}${CALLBACK}`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state: signState({ app, expiresAt: Date.now() + 10 * 60 * 1000 }),
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
}

export async function googleLoginCallback(req: Request, res: Response) {
  const state = readState(String(req.query.state || ''));
  const app = !!state?.app;
  try {
    const creds = credentials();
    if (!state || !creds || !req.query.code) return finish(res, app, { google_error: 'falhou' });

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId, client_secret: creds.clientSecret, code: String(req.query.code),
        grant_type: 'authorization_code', redirect_uri: `${appUrl()}${CALLBACK}`,
      }).toString(),
    });
    const token = await tokenRes.json() as any;
    if (!tokenRes.ok || !token.id_token) return finish(res, app, { google_error: 'falhou' });

    // The ID token came straight from Google's token endpoint over TLS, so its claims can be read
    // without re-verifying the signature (Google's own guidance for the server-side flow).
    const claims = JSON.parse(Buffer.from(String(token.id_token).split('.')[1], 'base64url').toString());
    if (claims.aud !== creds.clientId || !claims.email || claims.email_verified === false) {
      return finish(res, app, { google_error: 'falhou' });
    }

    const user = await prisma.user.findFirst({ where: { email: { equals: String(claims.email), mode: 'insensitive' } } });
    if (!user) return finish(res, app, { google_error: 'sem_conta', email: String(claims.email) });
    if (!user.avatarUrl && claims.picture) {
      await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: String(claims.picture) } }).catch(() => {});
    }

    const now = Date.now();
    for (const [key, value] of oneTimeCodes) if (value.expiresAt < now) oneTimeCodes.delete(key);
    const code = crypto.randomBytes(24).toString('base64url');
    oneTimeCodes.set(code, { userId: user.id, expiresAt: now + CODE_TTL });
    finish(res, app, { google_code: code });
  } catch {
    finish(res, app, { google_error: 'falhou' });
  }
}

export async function googleLoginExchange(req: Request, res: Response, next: NextFunction) {
  try {
    const code = String(req.body?.code || '');
    const entry = oneTimeCodes.get(code);
    oneTimeCodes.delete(code); // single use, even when expired
    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'O login com Google expirou. Tente novamente.' });
    }
    const user = await prisma.user.findUnique({ where: { id: entry.userId } });
    if (!user) return res.status(401).json({ error: 'Conta não encontrada.' });
    res.json(await issueSession(user));
  } catch (err) {
    next(err);
  }
}
