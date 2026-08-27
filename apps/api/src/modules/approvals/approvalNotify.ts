import { prisma } from '../../database/prisma';
import { getAgencySmtpConfig, sendMail } from '../../integrations/email/mailer';
import { sendWhatsAppMedia } from '../social/social.controller';

export interface ApprovalNotifyResult {
  emailSent: boolean;
  emailError?: string;
  whatsappSent: boolean;
  whatsappError?: string;
}

// Sends the creative + caption + approval link to the client automatically, via whichever
// channels the agency has configured (SMTP email and/or an active WhatsApp connection for
// this specific client) — called right after an approval link is generated, with no extra
// button for the user to press, and reusable by any automated flow (e.g. a future
// auto-request-on-CLIENT_REVIEW trigger) the same way publishToMeta is reused by the scheduler.
export async function sendApprovalNotifications(params: {
  agencyId: string; contentId: string; clientId: string; portalUrl: string;
}): Promise<ApprovalNotifyResult> {
  const { agencyId, contentId, clientId, portalUrl } = params;
  const result: ApprovalNotifyResult = { emailSent: false, whatsappSent: false };

  const [content, client] = await Promise.all([
    prisma.content.findFirst({
      where: { id: contentId, agencyId },
      include: { assets: { include: { asset: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    prisma.client.findFirst({ where: { id: clientId, agencyId } }),
  ]);
  if (!content || !client) return result;

  const image = content.assets[0]?.asset;
  const caption = [content.hook, content.caption, content.cta].filter(Boolean).join('\n\n') || content.title;

  if (client.email) {
    const smtp = await getAgencySmtpConfig(agencyId);
    if (smtp) {
      try {
        await sendMail(smtp, {
          to: client.email,
          subject: `Novo conteúdo para aprovação — ${content.title}`,
          html: buildApprovalEmailHtml({
            clientName: client.name, title: content.title, caption, imageUrl: image?.publicUrl ?? undefined, portalUrl,
          }),
        });
        result.emailSent = true;
      } catch (err: any) {
        result.emailError = err.message;
      }
    }
  }

  if (client.phone) {
    const connection = await prisma.socialConnection.findFirst({
      where: { agencyId, clientId, platform: 'WHATSAPP', status: 'ACTIVE' },
    });
    if (connection) {
      const message = `📢 Novo conteúdo para aprovação: *${content.title}*\n\n${caption}\n\n✅ Aprovar ou pedir ajustes: ${portalUrl}`;
      const sent = await sendWhatsAppMedia({ clientId, phone: client.phone, caption: message, mediaUrl: image?.publicUrl ?? undefined });
      result.whatsappSent = sent.success;
      if (!sent.success) result.whatsappError = sent.error;
    }
  }

  return result;
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
