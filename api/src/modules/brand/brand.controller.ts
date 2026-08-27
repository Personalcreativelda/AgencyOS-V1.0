import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../common/middleware/errorHandler';

async function ensureClientAccess(clientId: string, agencyId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, agencyId, deletedAt: null } });
  if (!client) throw new NotFoundError('Client not found');
  return client;
}

// PROFILE
export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    await ensureClientAccess(clientId, req.user!.agencyId);
    const profile = await prisma.brandProfile.findUnique({ where: { clientId } });
    if (!profile) return res.json({ clientId, message: 'Brand profile not yet configured' });
    res.json(profile);
  } catch (err) { next(err); }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    await ensureClientAccess(clientId, req.user!.agencyId);
    const { brandSummary, mission, vision, positioning, targetAudience, toneOfVoice, brandPersonality, defaultCta, primaryLanguage } = req.body;

    const profile = await prisma.brandProfile.upsert({
      where: { clientId },
      create: { agencyId: req.user!.agencyId, clientId, brandSummary, mission, vision, positioning, targetAudience, toneOfVoice, brandPersonality, defaultCta, primaryLanguage },
      update: { brandSummary, mission, vision, positioning, targetAudience, toneOfVoice, brandPersonality, defaultCta, primaryLanguage },
    });
    res.json(profile);
  } catch (err) { next(err); }
}

// RULES
export async function getRules(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    await ensureClientAccess(clientId, req.user!.agencyId);
    const rules = await prisma.brandRule.findMany({
      where: { clientId, agencyId: req.user!.agencyId, active: true },
      orderBy: [{ importance: 'desc' }, { ruleType: 'asc' }],
    });
    res.json(rules);
  } catch (err) { next(err); }
}

export async function createRule(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    await ensureClientAccess(clientId, req.user!.agencyId);
    const { ruleType, ruleText, source = 'MANUAL', importance = 5 } = req.body;
    if (!ruleType || !ruleText) return res.status(400).json({ error: 'ruleType and ruleText are required' });

    const rule = await prisma.brandRule.create({
      data: { agencyId: req.user!.agencyId, clientId, ruleType, ruleText, source, importance },
    });
    res.status(201).json(rule);
  } catch (err) { next(err); }
}

export async function updateRule(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { ruleId } = req.params;
    const { ruleText, importance, active } = req.body;
    const rule = await prisma.brandRule.update({ where: { id: ruleId }, data: { ruleText, importance, active } });
    res.json(rule);
  } catch (err) { next(err); }
}

export async function deleteRule(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { ruleId } = req.params;
    await prisma.brandRule.delete({ where: { id: ruleId } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// COLORS
export async function getColors(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    await ensureClientAccess(clientId, req.user!.agencyId);
    const colors = await prisma.brandColor.findMany({ where: { clientId }, orderBy: { priority: 'desc' } });
    res.json(colors);
  } catch (err) { next(err); }
}

export async function createColor(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    await ensureClientAccess(clientId, req.user!.agencyId);
    const { name, hex, rgb, usageNotes, priority } = req.body;
    const color = await prisma.brandColor.create({
      data: { agencyId: req.user!.agencyId, clientId, name, hex, rgb, usageNotes, priority: priority || 0 },
    });
    res.status(201).json(color);
  } catch (err) { next(err); }
}

export async function deleteColor(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.brandColor.delete({ where: { id: req.params.colorId } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// FONTS
export async function getFonts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const fonts = await prisma.brandFont.findMany({ where: { clientId } });
    res.json(fonts);
  } catch (err) { next(err); }
}

export async function createFont(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const { name, role, usageNotes } = req.body;
    const font = await prisma.brandFont.create({
      data: { agencyId: req.user!.agencyId, clientId, name, role: role || 'PRIMARY', usageNotes },
    });
    res.status(201).json(font);
  } catch (err) { next(err); }
}

export async function deleteFont(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.brandFont.delete({ where: { id: req.params.fontId } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// PRODUCTS
export async function getProducts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const products = await prisma.brandProduct.findMany({
      where: { clientId, agencyId: req.user!.agencyId, status: 'ACTIVE' },
    });
    res.json(products);
  } catch (err) { next(err); }
}

export async function createProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const { name, description, category, benefits, features, priceText } = req.body;
    const product = await prisma.brandProduct.create({
      data: {
        agencyId: req.user!.agencyId,
        clientId,
        name,
        description,
        category,
        benefits: benefits ? JSON.stringify(benefits) : null,
        features: features ? JSON.stringify(features) : null,
        priceText,
      },
    });
    res.status(201).json(product);
  } catch (err) { next(err); }
}

export async function updateProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params;
    const { name, description, category, priceText, status } = req.body;
    const product = await prisma.brandProduct.update({ where: { id: productId }, data: { name, description, category, priceText, status } });
    res.json(product);
  } catch (err) { next(err); }
}

export async function deleteProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.brandProduct.delete({ where: { id: req.params.productId } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// SERVICES
export async function getServices(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const services = await prisma.brandService.findMany({ where: { clientId, agencyId: req.user!.agencyId } });
    res.json(services);
  } catch (err) { next(err); }
}

export async function createService(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const { name, description, benefits, targetAudience } = req.body;
    const service = await prisma.brandService.create({
      data: { agencyId: req.user!.agencyId, clientId, name, description, benefits: benefits ? JSON.stringify(benefits) : null, targetAudience },
    });
    res.status(201).json(service);
  } catch (err) { next(err); }
}

export async function deleteService(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.brandService.delete({ where: { id: req.params.serviceId } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// PERSONAS
export async function getPersonas(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const personas = await prisma.brandPersona.findMany({ where: { clientId, agencyId: req.user!.agencyId } });
    res.json(personas);
  } catch (err) { next(err); }
}

export async function createPersona(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const { name, ageRange, location, profession, description, painPoints, goals, objections, preferredChannels } = req.body;
    const persona = await prisma.brandPersona.create({
      data: {
        agencyId: req.user!.agencyId,
        clientId,
        name,
        ageRange,
        location,
        profession,
        description,
        painPoints: painPoints ? JSON.stringify(painPoints) : null,
        goals: goals ? JSON.stringify(goals) : null,
        objections: objections ? JSON.stringify(objections) : null,
        preferredChannels: preferredChannels ? JSON.stringify(preferredChannels) : null,
      },
    });
    res.status(201).json(persona);
  } catch (err) { next(err); }
}

export async function deletePersona(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.brandPersona.delete({ where: { id: req.params.personaId } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// PILLARS
export async function getPillars(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const pillars = await prisma.brandContentPillar.findMany({ where: { clientId, agencyId: req.user!.agencyId } });
    res.json(pillars);
  } catch (err) { next(err); }
}

export async function createPillar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const { name, description, percentageTarget, examples } = req.body;
    const pillar = await prisma.brandContentPillar.create({
      data: {
        agencyId: req.user!.agencyId,
        clientId,
        name,
        description,
        percentageTarget,
        examples: examples ? JSON.stringify(examples) : null,
      },
    });
    res.status(201).json(pillar);
  } catch (err) { next(err); }
}

export async function deletePillar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.brandContentPillar.delete({ where: { id: req.params.pillarId } });
    res.status(204).send();
  } catch (err) { next(err); }
}

// FEEDBACK MEMORY
export async function getFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const feedback = await prisma.brandFeedbackMemory.findMany({
      where: { clientId, agencyId: req.user!.agencyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(feedback);
  } catch (err) { next(err); }
}

export async function createFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.params;
    const { feedbackText, normalizedInstruction, category, sentiment, isGlobalRule } = req.body;
    const feedback = await prisma.brandFeedbackMemory.create({
      data: {
        agencyId: req.user!.agencyId,
        clientId,
        feedbackText,
        normalizedInstruction,
        category,
        sentiment,
        isGlobalRule: isGlobalRule || false,
        createdById: req.user!.id,
      },
    });

    // If global rule, also create a brand rule
    if (isGlobalRule && normalizedInstruction) {
      await prisma.brandRule.create({
        data: {
          agencyId: req.user!.agencyId,
          clientId,
          ruleType: category || 'OTHER',
          ruleText: normalizedInstruction,
          source: 'CLIENT_FEEDBACK',
          importance: 8,
        },
      });
    }

    res.status(201).json(feedback);
  } catch (err) { next(err); }
}
