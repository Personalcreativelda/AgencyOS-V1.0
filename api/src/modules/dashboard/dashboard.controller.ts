import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';

export async function overview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const agencyId = req.user!.agencyId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [
      activeClients,
      totalContentsThisMonth,
      pendingApprovals,
      changesRequested,
      overdueContents,
      scheduledContents,
      publishedThisMonth,
      failedPublications,
    ] = await Promise.all([
      prisma.client.count({ where: { agencyId, status: 'ACTIVE', deletedAt: null } }),
      prisma.content.count({ where: { agencyId, deletedAt: null, createdAt: { gte: startOfMonth } } }),
      prisma.content.count({ where: { agencyId, status: 'CLIENT_REVIEW', deletedAt: null } }),
      prisma.content.count({ where: { agencyId, status: 'CHANGES_REQUESTED', deletedAt: null } }),
      prisma.content.count({
        where: { agencyId, deletedAt: null, dueAt: { lt: now }, status: { notIn: ['APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] } },
      }),
      prisma.content.count({ where: { agencyId, status: 'SCHEDULED', deletedAt: null } }),
      prisma.content.count({
        where: { agencyId, status: 'PUBLISHED', publishedAt: { gte: startOfMonth }, deletedAt: null },
      }),
      prisma.contentPlatform.count({ where: { agencyId, status: 'FAILED' } }),
    ]);

    res.json({
      activeClients,
      totalContentsThisMonth,
      pendingApprovals,
      changesRequested,
      overdueContents,
      scheduledContents,
      publishedThisMonth,
      failedPublications,
    });
  } catch (err) { next(err); }
}

export async function attention(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const agencyId = req.user!.agencyId;
    const now = new Date();
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const items: any[] = [];

    // Overdue content
    const overdue = await prisma.content.findMany({
      where: {
        agencyId,
        deletedAt: null,
        dueAt: { lt: now },
        status: { notIn: ['APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] },
      },
      include: { client: { select: { id: true, name: true, logoUrl: true } } },
      take: 10,
    });
    overdue.forEach(c => items.push({
      type: 'OVERDUE',
      priority: 'HIGH',
      clientId: c.clientId,
      clientName: (c as any).client?.name,
      clientLogoUrl: (c as any).client?.logoUrl,
      contentId: c.id,
      message: `"${c.title}" está atrasado (prazo: ${c.dueAt?.toLocaleDateString('pt-BR')})`,
    }));

    // Long pending approvals
    const longPending = await prisma.approvalRequest.findMany({
      where: { agencyId, status: { in: ['PENDING', 'VIEWED'] }, sentAt: { lt: threeDaysAgo } },
      include: {
        client: { select: { id: true, name: true, logoUrl: true } },
        content: { select: { id: true, title: true } },
      },
      take: 10,
    });
    longPending.forEach(a => items.push({
      type: 'APPROVAL_WAITING',
      priority: 'MEDIUM',
      clientId: a.clientId,
      clientName: (a as any).client?.name,
      clientLogoUrl: (a as any).client?.logoUrl,
      contentId: a.contentId,
      message: `Aprovação de "${(a as any).content?.title}" aguarda há mais de 3 dias`,
    }));

    // Changes requested
    const changesRequested = await prisma.content.findMany({
      where: { agencyId, status: 'CHANGES_REQUESTED', deletedAt: null },
      include: { client: { select: { id: true, name: true, logoUrl: true } } },
      take: 10,
    });
    changesRequested.forEach(c => items.push({
      type: 'CHANGES_REQUESTED',
      priority: 'HIGH',
      clientId: c.clientId,
      clientName: (c as any).client?.name,
      clientLogoUrl: (c as any).client?.logoUrl,
      contentId: c.id,
      message: `"${c.title}" tem alterações solicitadas pelo cliente`,
    }));

    // Clients without scheduled content in next 7 days
    const allClients = await prisma.client.findMany({
      where: { agencyId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, logoUrl: true },
    });

    for (const client of allClients) {
      const future = await prisma.content.count({
        where: {
          agencyId,
          clientId: client.id,
          status: { in: ['APPROVED', 'SCHEDULED'] },
          scheduledAt: { gte: now, lte: in7Days },
        },
      });
      if (future === 0) {
        items.push({
          type: 'NO_FUTURE_CONTENT',
          priority: 'LOW',
          clientId: client.id,
          clientName: client.name,
          clientLogoUrl: client.logoUrl,
          message: `${client.name} não tem conteúdo agendado nos próximos 7 dias`,
        });
      }
    }

    // Sort by priority
    const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    res.json({ items, total: items.length });
  } catch (err) { next(err); }
}
