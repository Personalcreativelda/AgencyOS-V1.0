import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
import { encrypt, decrypt, maskSecret } from '../../common/crypto';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v19.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

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

async function getAgencyMetaCredentials(agencyId: string) {
  const settings = await prisma.agencySocialSettings.findUnique({ where: { agencyId } });
  if (!settings?.metaAppId || !settings.metaAppSecretEncrypted) return null;
  return { appId: settings.metaAppId, appSecret: decrypt(settings.metaAppSecretEncrypted) };
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

export async function deleteConnection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const connection = await prisma.socialConnection.findFirst({
      where: { id: req.params.id, agencyId: req.user!.agencyId },
    });
    if (!connection) throw new NotFoundError('Connection not found');

    if (connection.platform === 'WHATSAPP') {
      await disconnectEvolutionInstance(instanceNameFor(connection.clientId)).catch(() => {});
    }

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
      redirect_uri: process.env.META_REDIRECT_URI || '',
      state,
      scope: scopes,
      response_type: 'code',
    }).toString();

    res.json({ authUrl });
  } catch (err) { next(err); }
}

export async function metaCallback(req: Request, res: Response, next: NextFunction) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    const { code, state, error: metaError } = req.query;
    if (metaError || !code || !state) {
      return res.redirect(`${appUrl}/app/settings?social_error=1`);
    }

    const { clientId, agencyId, userId } = JSON.parse(Buffer.from(String(state), 'base64url').toString());

    const credentials = await getAgencyMetaCredentials(agencyId);
    if (!credentials) throw new Error('Meta App credentials not configured for this agency');

    // Exchange code for a short-lived user token, then extend it to long-lived.
    const tokenRes = await fetch(`${GRAPH_URL}/oauth/access_token?` + new URLSearchParams({
      client_id: credentials.appId,
      client_secret: credentials.appSecret,
      redirect_uri: process.env.META_REDIRECT_URI || '',
      code: String(code),
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
    const userAccessToken = longLivedData.access_token || tokenData.access_token;

    // Fetch the Pages this user manages, and any linked Instagram Business Account.
    const pagesRes = await fetch(`${GRAPH_URL}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`);
    const pagesData = await pagesRes.json() as any;
    if (!pagesRes.ok) throw new Error(pagesData.error?.message || 'Failed to list Facebook Pages');

    for (const page of pagesData.data || []) {
      await upsertConnection(
        { agencyId, clientId, platform: 'FACEBOOK', externalPageId: page.id },
        { accountName: page.name, accessTokenEncrypted: encrypt(page.access_token), status: 'ACTIVE', connectedBy: userId }
      );

      if (page.instagram_business_account?.id) {
        const igId = page.instagram_business_account.id;
        const igInfoRes = await fetch(`${GRAPH_URL}/${igId}?fields=username&access_token=${page.access_token}`);
        const igInfo = await igInfoRes.json() as any;

        await upsertConnection(
          { agencyId, clientId, platform: 'INSTAGRAM', externalPageId: igId },
          { accountName: igInfo.username || 'Instagram', accessTokenEncrypted: encrypt(page.access_token), status: 'ACTIVE', connectedBy: userId }
        );
      }
    }

    res.redirect(`${appUrl}/app/settings?social_connected=1&clientId=${clientId}`);
  } catch (err) {
    console.error('Meta OAuth callback failed:', err);
    res.redirect(`${appUrl}/app/settings?social_error=1`);
  }
}

// ─── WHATSAPP (EVOLUTION API — self-hosted) ─────────────────────────────────
// Docs: https://doc.evolution-api.com — set EVOLUTION_API_URL / EVOLUTION_API_KEY in .env

function instanceNameFor(clientId: string) {
  return `agencyos-${clientId}`;
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

export async function whatsappConnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertEvolutionConfigured();
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: req.user!.agencyId } });
    if (!client) throw new NotFoundError('Client not found');

    const instanceName = instanceNameFor(clientId);

    const createRes = await fetch(`${process.env.EVOLUTION_API_URL}/instance/create`, {
      method: 'POST',
      headers: evolutionHeaders(),
      body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    });
    const createData = await createRes.json() as any;
    if (!createRes.ok) throw new Error(createData.message || createData.error || 'Failed to create WhatsApp instance');

    await upsertConnection(
      { agencyId: req.user!.agencyId, clientId, platform: 'WHATSAPP' },
      { externalUserId: instanceName, accountName: `WhatsApp — ${client.name}`, status: 'PENDING', connectedBy: req.user!.id }
    );

    const qrcode = createData.qrcode?.base64 || createData.qrcode || null;
    res.json({ instanceName, qrcode, status: 'PENDING' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao conectar WhatsApp.' });
  }
}

export async function whatsappStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertEvolutionConfigured();
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    const instanceName = instanceNameFor(String(clientId));
    const stateRes = await fetch(`${process.env.EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
      headers: evolutionHeaders(),
    });
    const stateData = await stateRes.json() as any;
    const rawState = stateData.instance?.state || stateData.state || 'close';
    const status = rawState === 'open' ? 'ACTIVE' : rawState === 'connecting' ? 'PENDING' : 'DISCONNECTED';

    await prisma.socialConnection.updateMany({
      where: { agencyId: req.user!.agencyId, clientId: String(clientId), platform: 'WHATSAPP' },
      data: { status },
    });

    res.json({ status, rawState });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao verificar status do WhatsApp.' });
  }
}

export async function whatsappDisconnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertEvolutionConfigured();
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    await disconnectEvolutionInstance(instanceNameFor(clientId));
    await prisma.socialConnection.deleteMany({
      where: { agencyId: req.user!.agencyId, clientId, platform: 'WHATSAPP' },
    });
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao desconectar WhatsApp.' });
  }
}

// Request-independent — reused by the approval-notification flow (approvalNotify.ts) to send
// the creative + caption + approval link as a WhatsApp message, the same way publishToMeta is
// reused by the scheduler.
export async function sendWhatsAppMedia(params: {
  clientId: string; phone: string; caption: string; mediaUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    assertEvolutionConfigured();
    const instanceName = instanceNameFor(params.clientId);
    const number = params.phone.replace(/\D/g, '');
    const endpoint = params.mediaUrl ? 'sendMedia' : 'sendText';
    const body = params.mediaUrl
      ? { number, mediatype: 'image', media: params.mediaUrl, caption: params.caption }
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
    const { clientId, phone, message } = req.body;
    if (!clientId || !phone || !message) {
      return res.status(400).json({ error: 'clientId, phone e message são obrigatórios.' });
    }

    const instanceName = instanceNameFor(clientId);
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

// ─── PUBLISH (FACEBOOK / INSTAGRAM) ─────────────────────────────────────────
//
// `publishToMeta` is the request-independent core — used by the manual "Publicar" button
// (via the `publishContent` HTTP handler below) AND by the scheduled publisher
// (see jobs/scheduledPublisher.ts), which has no req/res to work with.

export async function publishToMeta(params: {
  agencyId: string; contentId: string; platform: 'FACEBOOK' | 'INSTAGRAM';
}): Promise<{ success: boolean; externalPostId?: string; externalPostUrl?: string; error?: string }> {
  const { agencyId, contentId, platform } = params;
  try {
    const content = await prisma.content.findFirst({
      where: { id: contentId, agencyId, deletedAt: null },
      include: { assets: { include: { asset: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!content) throw new Error('Content not found');

    const connection = await prisma.socialConnection.findFirst({
      where: { agencyId, clientId: content.clientId, platform, status: 'ACTIVE' },
    });
    if (!connection || !connection.accessTokenEncrypted) {
      throw new Error(`Nenhuma conta ${platform === 'FACEBOOK' ? 'do Facebook' : 'do Instagram'} conectada para este cliente.`);
    }

    const image = content.assets[0]?.asset;
    const pageToken = decrypt(connection.accessTokenEncrypted);
    const caption = [content.hook, content.caption, content.cta].filter(Boolean).join('\n\n');

    let externalPostId: string;
    let externalPostUrl: string | undefined;

    if (platform === 'FACEBOOK') {
      if (image) {
        const publishRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: image.publicUrl, caption, access_token: pageToken }),
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
    } else {
      if (!image) throw new Error('Instagram exige uma imagem — gere ou envie um criativo primeiro.');

      const containerRes = await fetch(`${GRAPH_URL}/${connection.externalPageId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: image.publicUrl, caption, access_token: pageToken }),
      });
      const containerData = await containerRes.json() as any;
      if (!containerRes.ok) throw new Error(containerData.error?.message || 'Falha ao preparar publicação no Instagram');

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
    if (!contentId || !platform || !['FACEBOOK', 'INSTAGRAM'].includes(platform)) {
      return res.status(400).json({ error: 'contentId e platform (FACEBOOK ou INSTAGRAM) são obrigatórios.' });
    }

    const result = await publishToMeta({ agencyId: req.user!.agencyId, contentId, platform });
    if (!result.success) return res.status(400).json({ error: result.error });

    await prisma.content.update({ where: { id: contentId }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    res.json({ published: true, externalPostId: result.externalPostId, externalPostUrl: result.externalPostUrl });
  } catch (err) { next(err); }
}
