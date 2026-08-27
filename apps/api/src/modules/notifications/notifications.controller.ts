import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id, agencyId: req.user!.agencyId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({
        where: { userId: req.user!.id, agencyId: req.user!.agencyId, readAt: null },
      }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) { next(err); }
}

export async function markRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id, agencyId: req.user!.agencyId },
      data: { readAt: new Date() },
    });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function markAllRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, agencyId: req.user!.agencyId, readAt: null },
      data: { readAt: new Date() },
    });
    res.status(204).send();
  } catch (err) { next(err); }
}

// Internal helper — used by other modules to create a notification (e.g. approval events).
export async function notify(data: {
  agencyId: string; userId: string; type: string; title: string; message: string; entityId?: string;
}) {
  await prisma.notification.create({
    data: {
      agencyId: data.agencyId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.entityId ? JSON.stringify({ entityId: data.entityId }) : null,
    },
  }).catch(() => {}); // Non-blocking
}
