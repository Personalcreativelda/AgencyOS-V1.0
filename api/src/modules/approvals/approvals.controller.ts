import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/middleware/errorHandler';
import { notify } from '../notifications/notifications.controller';
import { sendApprovalNotifications } from './approvalNotify';

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

    // Expire old pending requests
    await prisma.approvalRequest.updateMany({
      where: { contentId, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });

    const token = uuidv4() + '-' + uuidv4() + '-' + Date.now().toString(36);
    const expiresAt = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
      : null;

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

    // Auto-dispatch to the client over whichever channels the agency has configured — no
    // extra button to press; generating the link and sending it are the same action.
    const sent = await sendApprovalNotifications({
      agencyId: req.user!.agencyId, contentId, clientId: content.clientId, portalUrl,
    });

    res.status(201).json({ ...approval, portalUrl, sent });
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
    res.json(approvals);
  } catch (err) { next(err); }
}

// PUBLIC PORTAL ROUTES
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
    res.json(approval);
  } catch (err) { next(err); }
}

export async function markViewed(req: Request, res: Response, next: NextFunction) {
  try {
    const approval = await getValidApproval(req.params.token);
    if (!approval.viewedAt) {
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

    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { token: req.params.token },
        data: { status: 'APPROVED', completedAt: new Date() },
      });

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
        data: { status: 'APPROVED' },
      });
    });

    notifyContentOwners(approval.content, approval.agencyId, {
      type: 'CONTENT_APPROVED',
      title: 'Conteúdo aprovado pelo cliente',
      message: `"${approval.content.title}" foi aprovado${actorName ? ` por ${actorName}` : ''}.`,
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
      await tx.approvalRequest.update({
        where: { token: req.params.token },
        data: { status: 'CHANGES_REQUESTED', completedAt: new Date() },
      });

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
      await tx.approvalRequest.update({
        where: { token: req.params.token },
        data: { status: 'REJECTED', completedAt: new Date() },
      });

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
