import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/middleware/errorHandler';

const CONTENT_INCLUDE = {
  client: { select: { id: true, name: true, slug: true, logoUrl: true, phone: true, email: true } },
  creator: { select: { id: true, name: true, avatarUrl: true } },
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  pillar: { select: { id: true, name: true } },
  platforms: true,
  assets: { include: { asset: true }, orderBy: { createdAt: 'desc' as const } },
  _count: { select: { comments: true, versions: true } },
};

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const agencyId = req.user!.agencyId;
    const { clientId, status, calendarId, platform, from, to, page = '1', limit = '30' } = req.query;

    const where: any = { agencyId, deletedAt: null };
    if (clientId) where.clientId = clientId;
    if (status) where.status = String(status);
    if (calendarId) where.calendarId = calendarId;
    if (platform) where.platforms = { some: { platform: String(platform) } };
    if (from || to) {
      where.scheduledAt = {
        ...(from ? { gte: new Date(String(from)) } : {}),
        ...(to ? { lte: new Date(String(to)) } : {}),
      };
    }

    const [total, contents] = await Promise.all([
      prisma.content.count({ where }),
      prisma.content.findMany({
        where,
        include: CONTENT_INCLUDE,
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
    ]);

    res.json({ data: contents, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const agencyId = req.user!.agencyId;
    const { clientId, calendarId, contentPillarId, title, contentType, objective, brief, hook, caption, cta, hashtags, priority, scheduledAt, dueAt, assignedToId, platforms } = req.body;

    if (!clientId || !title || !contentType) {
      return res.status(400).json({ error: 'clientId, title, and contentType are required' });
    }

    const content = await prisma.$transaction(async (tx) => {
      const c = await tx.content.create({
        data: {
          agencyId,
          clientId,
          calendarId,
          contentPillarId,
          title,
          contentType,
          objective,
          brief,
          hook,
          caption,
          cta,
          hashtags: hashtags ? JSON.stringify(hashtags) : null,
          status: 'DRAFT',
          priority: priority || 'MEDIUM',
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          dueAt: dueAt ? new Date(dueAt) : null,
          createdById: req.user!.id,
          assignedToId,
        },
        include: CONTENT_INCLUDE,
      });

      // Add platforms if provided
      if (platforms && platforms.length > 0) {
        await tx.contentPlatform.createMany({
          data: platforms.map((p: string) => ({ agencyId, contentId: c.id, platform: p })),
        });
      }

      // Create initial version
      await tx.contentVersion.create({
        data: {
          agencyId,
          contentId: c.id,
          versionNumber: 1,
          caption,
          hook,
          cta,
          brief,
          snapshot: JSON.stringify({ title, contentType, objective }),
          createdById: req.user!.id,
          changeReason: 'Initial version',
        },
      });

      return c;
    });

    res.status(201).json(content);
  } catch (err) { next(err); }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const content = await prisma.content.findFirst({
      where: { id, agencyId: req.user!.agencyId, deletedAt: null },
      include: {
        ...CONTENT_INCLUDE,
        assets: { include: { asset: true } },
        comments: {
          where: { parentId: null },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            replies: {
              include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!content) throw new NotFoundError('Content not found');
    res.json(content);
  } catch (err) { next(err); }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const existing = await prisma.content.findFirst({ where: { id, agencyId: req.user!.agencyId } });
    if (!existing) throw new NotFoundError('Content not found');

    const { title, brief, hook, caption, cta, hashtags, priority, scheduledAt, dueAt, assignedToId, contentPillarId, objective } = req.body;

    // Snapshot before update
    const versionCount = await prisma.contentVersion.count({ where: { contentId: id } });
    await prisma.contentVersion.create({
      data: {
        agencyId: req.user!.agencyId,
        contentId: id,
        versionNumber: versionCount + 1,
        caption: existing.caption,
        hook: existing.hook,
        cta: existing.cta,
        brief: existing.brief,
        createdById: req.user!.id,
        changeReason: req.body.changeReason || 'Content updated',
      },
    });

    const content = await prisma.content.update({
      where: { id },
      data: {
        title, brief, hook, caption, cta,
        hashtags: hashtags ? JSON.stringify(hashtags) : undefined,
        priority, assignedToId, contentPillarId, objective,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        dueAt: dueAt ? new Date(dueAt) : undefined,
      },
      include: CONTENT_INCLUDE,
    });
    res.json(content);
  } catch (err) { next(err); }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const existing = await prisma.content.findFirst({ where: { id, agencyId: req.user!.agencyId } });
    if (!existing) throw new NotFoundError('Content not found');
    await prisma.content.update({ where: { id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function changeStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const VALID_STATUSES = ['IDEA', 'DRAFT', 'IN_PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED'];
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const existing = await prisma.content.findFirst({ where: { id, agencyId: req.user!.agencyId } });
    if (!existing) throw new NotFoundError('Content not found');

    const content = await prisma.content.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
      },
      include: CONTENT_INCLUDE,
    });
    res.json(content);
  } catch (err) { next(err); }
}

export async function duplicate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const existing = await prisma.content.findFirst({ where: { id, agencyId: req.user!.agencyId } });
    if (!existing) throw new NotFoundError('Content not found');

    const copy = await prisma.content.create({
      data: {
        agencyId: existing.agencyId,
        clientId: existing.clientId,
        calendarId: existing.calendarId,
        contentPillarId: existing.contentPillarId,
        title: `${existing.title} (copy)`,
        contentType: existing.contentType,
        objective: existing.objective,
        brief: existing.brief,
        hook: existing.hook,
        caption: existing.caption,
        cta: existing.cta,
        hashtags: existing.hashtags,
        status: 'DRAFT',
        priority: existing.priority,
        createdById: req.user!.id,
      },
      include: CONTENT_INCLUDE,
    });
    res.status(201).json(copy);
  } catch (err) { next(err); }
}

// PLATFORMS
export async function getPlatforms(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const platforms = await prisma.contentPlatform.findMany({ where: { contentId: req.params.id } });
    res.json(platforms);
  } catch (err) { next(err); }
}

export async function addPlatform(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { platform } = req.body;
    const p = await prisma.contentPlatform.create({
      data: { agencyId: req.user!.agencyId, contentId: id, platform },
    });
    res.status(201).json(p);
  } catch (err) { next(err); }
}

export async function removePlatform(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.contentPlatform.delete({ where: { id: req.params.platformId } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// VERSIONS
export async function getVersions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const versions = await prisma.contentVersion.findMany({
      where: { contentId: req.params.id },
      include: { creator: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { versionNumber: 'desc' },
    });
    res.json(versions);
  } catch (err) { next(err); }
}

export async function createVersion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { caption, hook, cta, brief, changeReason } = req.body;
    const count = await prisma.contentVersion.count({ where: { contentId: id } });
    const version = await prisma.contentVersion.create({
      data: {
        agencyId: req.user!.agencyId,
        contentId: id,
        versionNumber: count + 1,
        caption, hook, cta, brief, changeReason,
        createdById: req.user!.id,
      },
    });
    res.status(201).json(version);
  } catch (err) { next(err); }
}

// COMMENTS
export async function getComments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const comments = await prisma.contentComment.findMany({
      where: { contentId: req.params.id, parentId: null },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        replies: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  } catch (err) { next(err); }
}

export async function addComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { comment, parentId, xPosition, yPosition } = req.body;
    const c = await prisma.contentComment.create({
      data: {
        agencyId: req.user!.agencyId,
        contentId: id,
        userId: req.user!.id,
        comment,
        parentId,
        xPosition,
        yPosition,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.status(201).json(c);
  } catch (err) { next(err); }
}

export async function updateComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { commentId } = req.params;
    const { resolved } = req.body;
    const c = await prisma.contentComment.update({ where: { id: commentId }, data: { resolved } });
    res.json(c);
  } catch (err) { next(err); }
}
