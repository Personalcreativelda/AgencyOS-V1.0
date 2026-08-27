import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/middleware/errorHandler';
import { resolveAgencyAIProvider } from '../../integrations/ai/ai.provider';

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.query;
    const where: any = { agencyId: req.user!.agencyId };
    if (clientId) where.clientId = clientId;

    const reports = await prisma.report.findMany({
      where,
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(reports);
  } catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, title, periodStart, periodEnd } = req.body;
    if (!clientId || !title || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'clientId, title, periodStart, periodEnd required' });
    }

    const agencyId = req.user!.agencyId;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    const [client, published, approvals] = await Promise.all([
      prisma.client.findFirst({ where: { id: clientId, agencyId } }),
      prisma.content.findMany({
        where: { agencyId, clientId, status: 'PUBLISHED', publishedAt: { gte: start, lte: end } },
        select: { id: true, title: true, contentType: true, publishedAt: true },
      }),
      prisma.approvalRequest.findMany({
        where: { agencyId, clientId, createdAt: { gte: start, lte: end } },
        select: { status: true },
      }),
    ]);
    if (!client) throw new NotFoundError('Client not found');

    const approvedCount = approvals.filter((a) => a.status === 'APPROVED').length;
    const changesRequestedCount = approvals.filter((a) => a.status === 'CHANGES_REQUESTED').length;

    const stats = {
      contentsPublished: published.length,
      contentsByType: published.reduce((acc: Record<string, number>, c) => {
        acc[c.contentType] = (acc[c.contentType] || 0) + 1;
        return acc;
      }, {}),
      approvalsSent: approvals.length,
      approvedCount,
      changesRequestedCount,
    };

    const ai = await resolveAgencyAIProvider(agencyId);
    const analysis = await ai.generateJSON<{ summary: string; aiAnalysis: string; recommendations: { title: string; description: string; priority: number }[] }>({
      systemPrompt: `Você é um estrategista sênior de social media escrevendo um relatório mensal de performance para o cliente de uma agência.
Retorne JSON: { "summary": string (2-3 frases, tom executivo), "aiAnalysis": string (parágrafo com leitura dos números), "recommendations": [{title, description, priority}] (2-4 recomendações acionáveis) }`,
      userPrompt: `Cliente: ${client.name} (${client.industry || 'sem segmento definido'})
Período: ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}
Conteúdos publicados: ${stats.contentsPublished}
Distribuição por tipo: ${JSON.stringify(stats.contentsByType)}
Aprovações enviadas ao cliente: ${stats.approvalsSent} (${stats.approvedCount} aprovadas de primeira, ${stats.changesRequestedCount} com pedido de ajuste)`,
    });

    const report = await prisma.report.create({
      data: {
        agencyId,
        clientId,
        title,
        periodStart: start,
        periodEnd: end,
        status: 'DRAFT',
        createdById: req.user!.id,
        summary: analysis.summary,
        aiAnalysis: analysis.aiAnalysis,
        recommendations: JSON.stringify(analysis.recommendations || []),
        snapshot: JSON.stringify({ ...stats, contents: published }),
      },
    });
    res.status(201).json(report);
  } catch (err) { next(err); }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const report = await prisma.report.findFirst({
      where: { id: req.params.id, agencyId: req.user!.agencyId },
      include: { client: true },
    });
    if (!report) throw new NotFoundError('Report not found');
    res.json(report);
  } catch (err) { next(err); }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { title, summary, aiAnalysis, recommendations } = req.body;
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { title, summary, aiAnalysis, recommendations: recommendations ? JSON.stringify(recommendations) : undefined },
    });
    res.json(report);
  } catch (err) { next(err); }
}

export async function publish(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = uuidv4() + '-' + Date.now().toString(36);
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: 'PUBLISHED', publicToken: token },
    });

    const publicUrl = `${process.env.APP_URL || 'http://localhost:5173'}/report/${token}`;
    res.json({ ...report, publicUrl });
  } catch (err) { next(err); }
}

export async function getPublicReport(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await prisma.report.findUnique({
      where: { publicToken: req.params.token },
      include: { client: { select: { name: true } } },
    });
    if (!report || report.status !== 'PUBLISHED') throw new NotFoundError('Report not found');
    res.json(report);
  } catch (err) { next(err); }
}
