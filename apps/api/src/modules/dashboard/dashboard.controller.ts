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

    // Long pending approvals — `distinct: ['contentId']` so a content that's had its approval
    // link regenerated several times (each regeneration leaves the earlier request rows behind
    // as history) only ever surfaces once here, as its single latest still-open request.
    // `content: { deletedAt: null }` — an approval request for a content that's since been
    // deleted (soft-delete, the row itself stays around) was never filtered out, so a deleted
    // post's stale "aguardando aprovação" alert stuck around on the dashboard forever.
    const longPending = await prisma.approvalRequest.findMany({
      where: {
        agencyId, status: { in: ['PENDING', 'VIEWED'] }, sentAt: { lt: threeDaysAgo },
        content: { deletedAt: null },
      },
      include: {
        client: { select: { id: true, name: true, logoUrl: true } },
        content: { select: { id: true, title: true } },
      },
      distinct: ['contentId'],
      orderBy: { sentAt: 'desc' },
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

type InsightsRange = '30d' | '90d' | '12m';
const RANGES: Record<InsightsRange, { days: number; bucket: 'day' | 'week' | 'month' }> = {
  '30d': { days: 30, bucket: 'day' },
  '90d': { days: 91, bucket: 'week' },
  '12m': { days: 365, bucket: 'month' },
};
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Start of the bucket a date falls in (server local time). */
function bucketStart(date: Date, bucket: 'day' | 'week' | 'month') {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (bucket === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (bucket === 'month') d.setDate(1);
  return d;
}

function bucketLabel(d: Date, bucket: 'day' | 'week' | 'month') {
  if (bucket === 'month') return MONTHS_PT[d.getMonth()];
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]}`;
}

/** Percentage change vs the previous period; null when there is no baseline to compare with. */
function delta(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Dashboard analytics for a time window: production series, KPIs with period-over-period change,
 * status / network mix, most active clients, upcoming posts and recent activity.
 * GET /dashboard/insights?range=30d|90d|12m
 */
export async function insights(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const agencyId = req.user!.agencyId;
    const range = (['30d', '90d', '12m'].includes(String(req.query.range)) ? req.query.range : '30d') as InsightsRange;
    const { days, bucket } = RANGES[range];

    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // exclusive: end of today
    const rawStart = new Date(end);
    rawStart.setDate(rawStart.getDate() - days);
    const start = bucketStart(rawStart, bucket);
    const prevStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
    const live = { agencyId, deletedAt: null };

    const [contents, prevCreated, prevPublished, statusGroups, platformRows, clientsActive, newClients, prevNewClients, upcoming, scheduledUpcoming, recent] =
      await Promise.all([
        prisma.content.findMany({
          where: { ...live, OR: [{ createdAt: { gte: start, lt: end } }, { publishedAt: { gte: start, lt: end } }] },
          select: { createdAt: true, publishedAt: true, status: true, clientId: true },
        }),
        prisma.content.count({ where: { ...live, createdAt: { gte: prevStart, lt: start } } }),
        prisma.content.count({ where: { ...live, status: 'PUBLISHED', publishedAt: { gte: prevStart, lt: start } } }),
        prisma.content.groupBy({ by: ['status'], where: { ...live, status: { not: 'ARCHIVED' } }, _count: { _all: true } }),
        prisma.contentPlatform.findMany({
          where: { agencyId, enabled: true, content: { deletedAt: null, createdAt: { gte: start, lt: end } } },
          select: { platform: true, status: true },
        }),
        prisma.client.count({ where: { ...live, status: 'ACTIVE' } }),
        prisma.client.count({ where: { ...live, createdAt: { gte: start, lt: end } } }),
        prisma.client.count({ where: { ...live, createdAt: { gte: prevStart, lt: start } } }),
        prisma.content.findMany({
          where: { ...live, scheduledAt: { gte: now }, status: { notIn: ['PUBLISHED', 'ARCHIVED'] } },
          orderBy: { scheduledAt: 'asc' },
          take: 5,
          select: {
            id: true, title: true, status: true, scheduledAt: true, contentType: true,
            client: { select: { id: true, name: true, logoUrl: true } },
            platforms: { where: { enabled: true }, select: { platform: true } },
          },
        }),
        prisma.content.count({ where: { ...live, scheduledAt: { gte: now }, status: { notIn: ['PUBLISHED', 'ARCHIVED'] } } }),
        prisma.content.findMany({
          where: live,
          orderBy: { updatedAt: 'desc' },
          take: 6,
          select: {
            id: true, title: true, status: true, updatedAt: true, contentType: true,
            client: { select: { id: true, name: true, logoUrl: true } },
          },
        }),
      ]);

    // Time series (created vs published per bucket)
    const buckets = new Map<number, { key: string; label: string; created: number; published: number }>();
    for (const d = new Date(start); d < end; ) {
      buckets.set(d.getTime(), { key: d.toISOString().slice(0, 10), label: bucketLabel(d, bucket), created: 0, published: 0 });
      if (bucket === 'day') d.setDate(d.getDate() + 1);
      else if (bucket === 'week') d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
    }
    let created = 0;
    let published = 0;
    const byClient = new Map<string, number>();
    for (const c of contents) {
      if (c.createdAt >= start && c.createdAt < end) {
        created++;
        const b = buckets.get(bucketStart(c.createdAt, bucket).getTime());
        if (b) b.created++;
        byClient.set(c.clientId, (byClient.get(c.clientId) || 0) + 1);
      }
      if (c.status === 'PUBLISHED' && c.publishedAt && c.publishedAt >= start && c.publishedAt < end) {
        published++;
        const b = buckets.get(bucketStart(c.publishedAt, bucket).getTime());
        if (b) b.published++;
      }
    }

    // Network mix: posts planned per network in the window, with failures
    const platformMap = new Map<string, { platform: string; count: number; failed: number }>();
    for (const p of platformRows) {
      const row = platformMap.get(p.platform) || { platform: p.platform, count: 0, failed: 0 };
      row.count++;
      if (p.status === 'FAILED') row.failed++;
      platformMap.set(p.platform, row);
    }

    // Most active clients in the window
    const topIds = [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topInfo = topIds.length
      ? await prisma.client.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, name: true, logoUrl: true, industry: true } })
      : [];
    const topClients = topIds.map(([id, count]) => ({ ...topInfo.find((c) => c.id === id), id, count }));

    res.json({
      range,
      bucket,
      from: start.toISOString(),
      to: end.toISOString(),
      series: [...buckets.values()],
      kpis: {
        created: { value: created, previous: prevCreated, delta: delta(created, prevCreated) },
        published: { value: published, previous: prevPublished, delta: delta(published, prevPublished) },
        clients: { value: clientsActive, added: newClients, delta: delta(newClients, prevNewClients) },
        scheduled: { value: scheduledUpcoming },
      },
      status: statusGroups.map((g) => ({ status: g.status, count: g._count._all })).sort((a, b) => b.count - a.count),
      platforms: [...platformMap.values()].sort((a, b) => b.count - a.count),
      topClients,
      upcoming,
      recent,
    });
  } catch (err) { next(err); }
}
