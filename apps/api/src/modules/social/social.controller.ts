import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
import { encrypt, decrypt, maskSecret } from '../../common/crypto';
import { GRAPH_URL, GRAPH_VERSION, buildMetaRedirectUri, getAgencyMetaCredentials, exchangeCodeForLongLivedToken } from '../../integrations/meta/metaClient';

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
    await prisma.agencySocialSettings.deleteMany({ where: { agencyId: req.user!.agencyId } });
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

    const { clientId, agencyId, userId } = JSON.parse(Buffer.from(String(state), 'base64url').toString());

    const credentials = await getAgencyMetaCredentials(agencyId);
    if (!credentials) throw new Error('Meta App credentials not configured for this agency');

    // Exchange code for a short-lived user token, then extend it to long-lived.
    const userAccessToken = await exchangeCodeForLongLivedToken(credentials, String(code), getMetaRedirectUri());

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
        assets: { include: { asset: true }, orderBy: { createdAt: 'desc' }, take: 1 },
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
      include: { assets: { include: { asset: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!content) throw new Error('Content not found');

    const connection = await prisma.socialConnection.findFirst({
      where: { agencyId, clientId: content.clientId, platform: connectionPlatform, status: 'ACTIVE' },
    });
    if (!connection || !connection.accessTokenEncrypted) {
      throw new Error(`Nenhuma conta ${connectionPlatform === 'FACEBOOK' ? 'do Facebook' : 'do Instagram'} conectada para este cliente.`);
    }

    const media = content.assets[0]?.asset;
    const isVideo = !!media?.mimeType?.startsWith('video/');
    const pageToken = decrypt(connection.accessTokenEncrypted);
    const caption = [content.hook, content.caption, content.cta].filter(Boolean).join('\n\n');

    let externalPostId: string;
    let externalPostUrl: string | undefined;

    if (platform === 'FACEBOOK') {
      if (media && isVideo) {
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

    const existingPlatform = await prisma.contentPlatform.findFirst({ where: { contentId, platform } });
    const platformData = { status: 'PUBLISHED', externalPostId, externalPostUrl, publishedAt: new Date(), publishError: null };
    if (existingPlatform) {
      await prisma.contentPlatform.update({ where: { id: existingPlatform.id }, data: platformData });
    } else {
      await prisma.contentPlatform.create({ data: { agencyId, contentId, platform, enabled: true, ...platformData } });
    }

    return { success: true, externalPostId, externalPostUrl };
  } catch (err: any) {
    const existingPlatform = await prisma.contentPlatform.findFirst({ where: { contentId, platform } }).catch(() => null);
    const errorData = { status: 'FAILED', publishError: err.message };
    if (existingPlatform) {
      await prisma.contentPlatform.update({ where: { id: existingPlatform.id }, data: errorData }).catch(() => {});
    } else {
      await prisma.contentPlatform.create({ data: { agencyId, contentId, platform, enabled: true, ...errorData } }).catch(() => {});
    }
    return { success: false, error: err.message || 'Erro ao publicar conteúdo.' };
  }
}

export async function publishContent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId, platform } = req.body;
    if (!contentId || !platform || !['FACEBOOK', 'INSTAGRAM', 'INSTAGRAM_STORY'].includes(platform)) {
      return res.status(400).json({ error: 'contentId e platform (FACEBOOK, INSTAGRAM ou INSTAGRAM_STORY) são obrigatórios.' });
    }

    const result = await publishToMeta({ agencyId: req.user!.agencyId, contentId, platform });
    if (!result.success) return res.status(400).json({ error: result.error });

    await prisma.content.update({ where: { id: contentId }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    res.json({ published: true, externalPostId: result.externalPostId, externalPostUrl: result.externalPostUrl });
  } catch (err) { next(err); }
}
