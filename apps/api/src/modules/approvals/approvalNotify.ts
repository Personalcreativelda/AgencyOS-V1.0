import { prisma } from '../../database/prisma';
import { getAgencySmtpConfig, sendMail } from '../../integrations/email/mailer';
import { sendWhatsAppMedia } from '../social/social.controller';

// Sending is always a manual, explicit action by the agency (a button press) — generating an
// approval link never fires these on its own. Each function below sends over one channel only,
// so the "Enviar" button per channel in the approval modal can succeed/fail independently.

async function loadContentForNotification(agencyId: string, contentId: string) {
  const content = await prisma.content.findFirst({
    where: { id: contentId, agencyId },
    include: { assets: { include: { asset: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!content) return null;
  const media = content.assets[0]?.asset;
  const isVideo = !!media?.mimeType?.startsWith('video/');
  const caption = [content.hook, content.caption, content.cta].filter(Boolean).join('\n\n') || content.title;
  return { content, media, isVideo, caption };
}

export async function sendApprovalEmail(params: {
  agencyId: string; contentId: string; email: string; clientName: string; portalUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const data = await loadContentForNotification(params.agencyId, params.contentId);
  if (!data) return { success: false, error: 'Conteúdo não encontrado.' };

  const smtp = await getAgencySmtpConfig(params.agencyId);
  if (!smtp) return { success: false, error: 'Configure o SMTP em Configurações.' };

  try {
    await sendMail(smtp, {
      to: params.email,
      subject: `Novo conteúdo para aprovação — ${data.content.title}`,
      html: buildApprovalEmailHtml({
        clientName: params.clientName, title: data.content.title, caption: data.caption,
        // Email clients don't reliably play inline video, so only embed actual images —
        // the portal link still lets the client watch the real video.
        imageUrl: !data.isVideo ? (data.media?.publicUrl ?? undefined) : undefined, portalUrl: params.portalUrl,
      }),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao enviar o email.' };
  }
}

export async function sendApprovalWhatsApp(params: {
  agencyId: string; contentId: string; phone: string; portalUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const data = await loadContentForNotification(params.agencyId, params.contentId);
  if (!data) return { success: false, error: 'Conteúdo não encontrado.' };

  const message = `📢 Novo conteúdo para aprovação: *${data.content.title}*\n\n${data.caption}\n\n✅ Aprovar ou pedir ajustes: ${params.portalUrl}`;
  return sendWhatsAppMedia({
    agencyId: params.agencyId, phone: params.phone, caption: message,
    mediaUrl: data.media?.publicUrl ?? undefined,
    mediaType: data.isVideo ? 'video' : 'image',
  });
}

function buildApprovalEmailHtml(params: { clientName: string; title: string; caption: string; imageUrl?: string; portalUrl: string }) {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f4f6f8;">
    <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1);">
      ${params.imageUrl ? `<img src="${params.imageUrl}" alt="" style="width: 100%; display: block;" />` : ''}
      <div style="padding: 24px;">
        <p style="color: #00A76F; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; margin: 0 0 8px;">Novo conteúdo para aprovação</p>
        <h1 style="font-size: 20px; margin: 0 0 12px; color: #212B36;">${params.title}</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #454F5B; white-space: pre-line; margin: 0 0 24px;">${params.caption}</p>
        <a href="${params.portalUrl}" style="display: inline-block; background: #00A76F; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 12px;">Ver e Aprovar Conteúdo</a>
      </div>
    </div>
    <p style="text-align: center; font-size: 11px; color: #919EAB; margin-top: 16px;">Enviado via AgencyOS em nome de ${params.clientName}</p>
  </div>`;
}
