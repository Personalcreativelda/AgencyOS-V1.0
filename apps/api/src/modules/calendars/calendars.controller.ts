import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/middleware/errorHandler';

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, month, year } = req.query;
    const where: any = { agencyId: req.user!.agencyId };
    if (clientId) where.clientId = clientId;
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);

    const calendars = await prisma.contentCalendar.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, slug: true } },
        _count: { select: { contents: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(calendars);
  } catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, name, month, year, strategyId } = req.body;
    if (!clientId || !name || !month || !year) {
      return res.status(400).json({ error: 'clientId, name, month, year are required' });
    }
    // A client can only have one calendar per month/year (`@@unique([clientId, month, year])`).
    // Upsert instead of a bare create so re-generating a month (e.g. running the AI calendar
    // generator again after adding more posts) reuses the existing calendar instead of failing
    // on the unique constraint.
    const calendar = await prisma.contentCalendar.upsert({
      where: { clientId_month_year: { clientId, month: Number(month), year: Number(year) } },
      update: { name, strategyId },
      create: {
        agencyId: req.user!.agencyId,
        clientId,
        name,
        month: Number(month),
        year: Number(year),
        strategyId,
        createdById: req.user!.id,
      },
    });
    res.status(201).json(calendar);
  } catch (err) { next(err); }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const calendar = await prisma.contentCalendar.findFirst({
      where: { id: req.params.id, agencyId: req.user!.agencyId },
      include: { client: true, strategy: true },
    });
    if (!calendar) throw new NotFoundError('Calendar not found');
    res.json(calendar);
  } catch (err) { next(err); }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, status } = req.body;
    const calendar = await prisma.contentCalendar.update({
      where: { id: req.params.id },
      data: { name, status },
    });
    res.json(calendar);
  } catch (err) { next(err); }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.contentCalendar.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function getContents(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const contents = await prisma.content.findMany({
      where: { calendarId: req.params.id, agencyId: req.user!.agencyId, deletedAt: null },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        pillar: { select: { id: true, name: true } },
        platforms: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json(contents);
  } catch (err) { next(err); }
}
