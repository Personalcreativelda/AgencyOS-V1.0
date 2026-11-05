import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
import { prisma } from '../../database/prisma';
import { getMetaPerformanceInsights } from '../ads/ads.controller';
import { getGooglePerformanceInsights } from '../google/google.controller';
import { getAdPlatformReport } from '../adPlatforms/adPlatforms.controller';

const DAYS: Record<string, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90 };

async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

export async function overview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const agencyId = req.user!.agencyId;
    const range = String(req.query.range || '30d');
    if (!(range in DAYS)) throw new ValidationError('Período inválido.');
    const days = DAYS[range];
    const requestedClientId = String(req.query.clientId || 'all');
    const refresh = req.query.refresh === '1';

    const clients = await prisma.client.findMany({
      where: { agencyId, deletedAt: null },
      select: { id: true, name: true, status: true, website: true },
      orderBy: { name: 'asc' },
    });
    if (requestedClientId !== 'all' && !clients.some(client => client.id === requestedClientId)) {
      throw new NotFoundError('Cliente não encontrado.');
    }
    const selectedIds = requestedClientId === 'all' ? clients.map(client => client.id) : [requestedClientId];
    const selectedSet = new Set(selectedIds);
    const connections = await prisma.socialConnection.findMany({
      where: { agencyId, clientId: { in: selectedIds } },
      orderBy: { createdAt: 'desc' },
    });

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - days + 1);
    const published = await prisma.contentPlatform.findMany({
      where: { agencyId, status: 'PUBLISHED', publishedAt: { gte: since },
        content: { clientId: { in: selectedIds }, deletedAt: null } },
      select: { id: true, platform: true, publishedAt: true, externalPostUrl: true,
        content: { select: { clientId: true, title: true } } },
      orderBy: { publishedAt: 'desc' },
    });

    const reportConnections = connections.filter(connection => connection.status === 'ACTIVE' &&
      ['META_ADS', 'GOOGLE_ADS', 'TIKTOK_ADS', 'LINKEDIN_ADS', 'GOOGLE_ANALYTICS'].includes(connection.platform));
    const reports = await mapLimited(reportConnections, 4, async connection => {
      try {
        if (connection.platform === 'META_ADS') {
          return { platform: connection.platform, clientId: connection.clientId,
            data: await getMetaPerformanceInsights(connection, days, refresh), error: null };
        }
        if (connection.platform === 'TIKTOK_ADS' || connection.platform === 'LINKEDIN_ADS') {
          const data = await getAdPlatformReport(connection, range);
          return { platform: connection.platform, clientId: connection.clientId,
            data: { ...data, daily: [] }, error: null };
        }
        const data = await getGooglePerformanceInsights(connection, days);
        return { platform: connection.platform, clientId: connection.clientId,
          data: { ...data, clientId: connection.clientId }, error: null };
      } catch (error) {
        // A failed account must not hide the other clients' valid reports.
        return { platform: connection.platform, clientId: connection.clientId,
          connectionId: connection.id, data: null,
          error: error instanceof Error ? error.message.slice(0, 240) : 'Não foi possível carregar esta conta.' };
      }
    });

    res.json({
      range, generatedAt: new Date().toISOString(),
      clients,
      connections: connections.filter(row => selectedSet.has(row.clientId)).map(row => ({
        id: row.id, clientId: row.clientId, platform: row.platform,
        accountName: row.accountName, status: row.status,
      })),
      reports,
      posts: published.map(row => ({ id: row.id, clientId: row.content.clientId,
        title: row.content.title, platform: row.platform === 'INSTAGRAM_STORY' ? 'INSTAGRAM' : row.platform,
        publishedAt: row.publishedAt, url: row.externalPostUrl })),
    });
  } catch (error) { next(error); }
}
