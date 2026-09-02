import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError, ConflictError } from '../../common/middleware/errorHandler';

export async function getCurrent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const agency = await prisma.agency.findUnique({
      where: { id: req.user!.agencyId },
    });
    if (!agency) throw new NotFoundError('Agency not found');
    res.json(agency);
  } catch (err) { next(err); }
}

export async function updateCurrent(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, logoUrl, country, timezone, locale, kanbanColumns } = req.body;

    if (kanbanColumns !== undefined && kanbanColumns !== null) {
      const valid = Array.isArray(kanbanColumns) && kanbanColumns.every(
        (c) => c && typeof c.key === 'string' && typeof c.label === 'string' && c.label.trim()
          && typeof c.order === 'number' && typeof c.hidden === 'boolean'
      );
      if (!valid) return res.status(400).json({ error: 'kanbanColumns must be an array of { key, label, order, hidden }' });
    }

    const agency = await prisma.agency.update({
      where: { id: req.user!.agencyId },
      data: {
        name, logoUrl, country, timezone, locale,
        ...(kanbanColumns !== undefined && {
          kanbanColumns: kanbanColumns === null ? null : JSON.stringify(kanbanColumns),
        }),
      },
    });
    res.json(agency);
  } catch (err) { next(err); }
}

export async function getMembers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const members = await prisma.agencyMember.findMany({
      where: { agencyId: req.user!.agencyId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(members);
  } catch (err) { next(err); }
}

export async function inviteMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, role = 'MANAGER' } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found. They must register first.' });

    const existing = await prisma.agencyMember.findUnique({
      where: { agencyId_userId: { agencyId: req.user!.agencyId, userId: user.id } },
    });
    if (existing) throw new ConflictError('User is already a member');

    const member = await prisma.agencyMember.create({
      data: {
        agencyId: req.user!.agencyId,
        userId: user.id,
        role,
        status: 'ACTIVE',
        invitedAt: new Date(),
        joinedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
    res.status(201).json(member);
  } catch (err) { next(err); }
}

export async function updateMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { role, status } = req.body;
    const member = await prisma.agencyMember.update({
      where: { id },
      data: { role, status },
    });
    res.json(member);
  } catch (err) { next(err); }
}

export async function removeMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await prisma.agencyMember.delete({ where: { id } });
    res.status(204).send();
  } catch (err) { next(err); }
}
