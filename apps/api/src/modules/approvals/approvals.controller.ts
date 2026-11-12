import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError, ConflictError } from '../../common/middleware/errorHandler';
import { notify } from '../notifications/notifications.controller';
import { sendApprovalEmail, sendApprovalWhatsApp } from './approvalNotify';

function notifyContentOwners(content: { createdById: string; assignedToId?: string | null; title: string }, agencyId: string, opts: { type: string; title: string; message: string; entityId?: string }) {
  const recipients = new Set([content.createdById, content.assignedToId].filter(Boolean) as string[]);
  for (const userId of recipients) {
    notify({ agencyId, userId, ...opts });
  }
}

export async function requestApproval(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId } = req.params;
    const { expiresInDays } = req.body;

    const content = await prisma.content.findFirst({
      where: { id: contentId, agencyId: req.user!.agencyId, deletedAt: null },
    });
    if (!content) throw new NotFoundError('Content not found');

    const expiresAt = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
      : null;

    // One link per content: while a request is still open (sent / viewed, not past its date) the
    // same link is returned again instead of creating a second one — the client may already have
    // it on WhatsApp/e-mail, and a new link would leave the old one showing as "Expirado".
    const open = await prisma.approvalRequest.findFirst({
      where: { contentId, agencyId: req.user!.agencyId, status: { in: ['PENDING', 'VIEWED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (open && (!open.expiresAt || open.expiresAt > new Date())) {
      const [reused] = await prisma.$transaction([
        prisma.approvalRequest.update({ where: { id: open.id }, data: { sentAt: new Date(), ...(expiresInDays ? { expiresAt } : {}) } }),
        prisma.content.update({ where: { id: contentId }, data: { status: 'CLIENT_REVIEW' } }),
      ]);
      return res.status(200).json({ ...reused, portalUrl: `${process.env.APP_URL || 'http://localhost:5173'}/approval/${reused.token}` });
    }

    // Any other still-open request for this content (past its date) is replaced by the new link:
    // remove it so it doesn't linger in the list as a duplicate.
    await prisma.approvalRequest.deleteMany({
      where: { contentId, agencyId: req.user!.agencyId, status: { in: ['PENDING', 'VIEWED'] } },
    });

    const token = uuidv4() + '-' + uuidv4() + '-' + Date.now().toString(36);

    const approval = await prisma.$transaction(async (tx) => {
      const req_ = await tx.approvalRequest.create({
        data: {
          agencyId: req.user!.agencyId,
          clientId: content.clientId,
          contentId,
          token,
          status: 'PENDING',
          requestedBy: req.user!.id,
          expiresAt,
          sentAt: new Date(),
        },
      });

      // Move content to CLIENT_REVIEW
      await tx.content.update({
        where: { id: contentId },
        data: { status: 'CLIENT_REVIEW' },
      });

      return req_;
    });

    const portalUrl = `${process.env.APP_URL || 'http://localhost:5173'}/approval/${token}`;

    // Generating the link never sends anything on its own — the agency presses "Enviar" per
    // channel (see sendApprovalEmailManual / sendApprovalWhatsAppManual below) whenever it wants.
    res.status(201).json({ ...approval, portalUrl });
  } catch (err) { next(err); }
}

export async function sendApprovalEmailManual(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId } = req.params;
    const { email, clientName, portalUrl } = req.body;
    if (!email || !portalUrl) return res.status(400).json({ error: 'email e portalUrl são obrigatórios.' });

    const result = await sendApprovalEmail({ agencyId: req.user!.agencyId, contentId, email, clientName: clientName || '', portalUrl });
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ sent: true });
  } catch (err) { next(err); }
}

export async function sendApprovalWhatsAppManual(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { contentId } = req.params;
    const { phone, portalUrl } = req.body;
    if (!phone || !portalUrl) return res.status(400).json({ error: 'phone e portalUrl são obrigatórios.' });

    const result = await sendApprovalWhatsApp({ agencyId: req.user!.agencyId, contentId, phone, portalUrl });
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ sent: true });
  } catch (err) { next(err); }
}

export async function listApprovals(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status, clientId } = req.query;
    const where: any = { agencyId: req.user!.agencyId };
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;

    const approvals = await prisma.approvalRequest.findMany({
      where,
      include: {
        content: { select: { id: true, title: true, contentType: true, status: true } },
        client: { select: { id: true, name: true, logoUrl: true } },
        actions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    // Links replaced by a newer one for the same content (older data) are not shown as duplicates.
    const newest = new Map<string, string>();
    for (const a of approvals) if (!newest.has(a.contentId)) newest.set(a.contentId, a.id);
    res.json(approvals.filter(a => a.status !== 'EXPIRED' || newest.get(a.contentId) === a.id));
  } catch (err) { next(err); }
}

export async function deleteApproval(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const approval = await prisma.approvalRequest.findFirst({ where: { id, agencyId: req.user!.agencyId } });
    if (!approval) throw new NotFoundError('Approval request not found');

    // Only removes this link's own record (and its ApprovalAction history, cascaded at the DB
    // level) — it never touches the Content it was generated for.
    await prisma.approvalRequest.delete({ where: { id } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// PUBLIC PORTAL ROUTES
// After a decision the link is closed: the client sees the outcome, never the buttons again, so
// one link can't approve twice (or approve after asking for changes). A new version needs a new link.
const FINAL_STATUSES = ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'];

/** Atomically claims the link for a decision — two taps / two devices can't both succeed. */
async function claimDecision(tx: any, token: string, status: string) {
  const { count } = await tx.approvalRequest.updateMany({
    where: { token, status: { notIn: FINAL_STATUSES } },
    data: { status, completedAt: new Date() },
  });
  if (!count) throw new ConflictError('Este link de aprovação já foi respondido. Peça à agência um novo link se precisar de alterar a decisão.');
}

async function getValidApproval(token: string) {
  const approval = await prisma.approvalRequest.findUnique({
    where: { token },
    include: {
      content: {
        include: {
          platforms: true,
          assets: { include: { asset: true } },
          comments: {
            where: { parentId: null },
            orderBy: { createdAt: 'asc' },
          },
          versions: { orderBy: { versionNumber: 'desc' }, take: 3 },
        },
      },
      client: { select: { id: true, name: true, logoUrl: true } },
      actions: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!approval) throw new NotFoundError('Approval request not found');
  if (approval.expiresAt && approval.expiresAt < new Date()) {
    throw new NotFoundError('This approval link has expired');
  }

  return approval;
}

export async function getPortal(req: Request, res: Response, next: NextFunction) {
  try {
    const approval = await getValidApproval(req.params.token);
    res.json({ ...approval, closed: FINAL_STATUSES.includes(approval.status) });
  } catch (err) { next(err); }
}

export async function markViewed(req: Request, res: Response, next: NextFunction) {
  try {
    const approval = await getValidApproval(req.params.token);
    if (!approval.viewedAt && !FINAL_STATUSES.includes(approval.status)) {
      await prisma.approvalRequest.update({
        where: { token: req.params.token },
        data: { status: 'VIEWED', viewedAt: new Date() },
      });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const { actorName, actorEmail, comment } = req.body;
    const approval = await getValidApproval(req.params.token);

    // Approved by the client = ready to go out. When the post already has a future date and at
    // least one network to publish to, it goes straight to SCHEDULED (the scheduled publisher
    // posts it on time). Without a date — or with a date already past, which would publish it
    // immediately — it stays APPROVED for the agency to pick a date.
    let nextStatus = 'APPROVED' as 'APPROVED' | 'SCHEDULED';
    await prisma.$transaction(async (tx) => {
      await claimDecision(tx, req.params.token, 'APPROVED');

      const current = await tx.content.findUnique({ where: { id: approval.contentId }, select: { scheduledAt: true } });
      const networks = await tx.contentPlatform.count({
        where: { contentId: approval.contentId, enabled: true, status: 'PENDING', platform: { in: ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'WHATSAPP'] } },
      });
      if (current?.scheduledAt && current.scheduledAt.getTime() > Date.now() + 60_000 && networks > 0) nextStatus = 'SCHEDULED';

      await tx.approvalAction.create({
        data: {
          agencyId: approval.agencyId,
          approvalRequestId: approval.id,
          action: 'APPROVED',
          comment,
          actorName,
          actorEmail,
        },
      });

      await tx.content.update({
        where: { id: approval.contentId },
        data: { status: nextStatus },
      });
    });

    notifyContentOwners(approval.content, approval.agencyId, {
      type: 'CONTENT_APPROVED',
      title: nextStatus === 'SCHEDULED' ? 'Aprovado e agendado' : 'Conteúdo aprovado pelo cliente',
      message: nextStatus === 'SCHEDULED'
        ? `"${approval.content.title}" foi aprovado${actorName ? ` por ${actorName}` : ''} e já está agendado para publicação automática.`
        : `"${approval.content.title}" foi aprovado${actorName ? ` por ${actorName}` : ''}. Defina uma data para o agendar.`,
      entityId: approval.contentId,
    });

    res.json({ message: 'Content approved successfully!' });
  } catch (err) { next(err); }
}

export async function requestChanges(req: Request, res: Response, next: NextFunction) {
  try {
    const { actorName, actorEmail, comment } = req.body;
    if (!comment) return res.status(400).json({ error: 'Please describe the changes needed' });

    const approval = await getValidApproval(req.params.token);

    await prisma.$transaction(async (tx) => {
      await claimDecision(tx, req.params.token, 'CHANGES_REQUESTED');

      await tx.approvalAction.create({
        data: {
          agencyId: approval.agencyId,
          approvalRequestId: approval.id,
          action: 'CHANGES_REQUESTED',
          comment,
          actorName,
          actorEmail,
        },
      });

      await tx.content.update({
        where: { id: approval.contentId },
        data: { status: 'CHANGES_REQUESTED' },
      });

      // Store as feedback memory
      if (comment) {
        await tx.brandFeedbackMemory.create({
          data: {
            agencyId: approval.agencyId,
            clientId: approval.clientId,
            contentId: approval.contentId,
            feedbackText: comment,
            category: 'COPY',
            sentiment: 'NEGATIVE',
          },
        });
      }
    });

    notifyContentOwners(approval.content, approval.agencyId, {
      type: 'CHANGES_REQUESTED',
      title: 'Cliente solicitou alterações',
      message: `${actorName || 'O cliente'} pediu ajustes em "${approval.content.title}": ${comment.substring(0, 120)}`,
      entityId: approval.contentId,
    });

    res.json({ message: 'Changes requested successfully. The team will be notified.' });
  } catch (err) { next(err); }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const { actorName, actorEmail, comment } = req.body;
    const approval = await getValidApproval(req.params.token);

    await prisma.$transaction(async (tx) => {
      await claimDecision(tx, req.params.token, 'REJECTED');

      await tx.approvalAction.create({
        data: {
          agencyId: approval.agencyId,
          approvalRequestId: approval.id,
          action: 'REJECTED',
          comment,
          actorName,
          actorEmail,
        },
      });

      await tx.content.update({
        where: { id: approval.contentId },
        data: { status: 'CHANGES_REQUESTED' },
      });
    });

    res.json({ message: 'Feedback submitted.' });
  } catch (err) { next(err); }
}

export async function addComment(req: Request, res: Response, next: NextFunction) {
  try {
    const { actorName, comment } = req.body;
    const approval = await getValidApproval(req.params.token);

    await prisma.approvalAction.create({
      data: {
        agencyId: approval.agencyId,
        approvalRequestId: approval.id,
        action: 'COMMENTED',
        comment,
        actorName,
      },
    });

    res.status(201).json({ message: 'Comment added.' });
  } catch (err) { next(err); }
}
