import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { resolveAgencyAIProvider, getAIProvider, AIProvider, CONTENT_TYPES_PT } from '../../integrations/ai/ai.provider';
import { NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
import { encrypt, decrypt, maskSecret } from '../../common/crypto';
import { getStorageProvider } from '../../common/storage';
import { compositeLogoOntoImage } from '../../integrations/ai/imageCompose';

async function getBrandContext(clientId: string, agencyId: string) {
  const [profile, rules, products, services, personas, pillars, colors, fonts, referenceImages] = await Promise.all([
    prisma.brandProfile.findUnique({ where: { clientId } }),
    prisma.brandRule.findMany({ where: { clientId, agencyId, active: true }, take: 20 }),
    prisma.brandProduct.findMany({ where: { clientId, agencyId, status: 'ACTIVE' }, take: 10 }),
    prisma.brandService.findMany({ where: { clientId, agencyId }, take: 10 }),
    prisma.brandPersona.findMany({ where: { clientId, agencyId }, take: 5 }),
    prisma.brandContentPillar.findMany({ where: { clientId, agencyId, status: 'ACTIVE' } }),
    prisma.brandColor.findMany({ where: { clientId, agencyId }, orderBy: { priority: 'asc' }, take: 5 }),
    prisma.brandFont.findMany({ where: { clientId, agencyId }, take: 5 }),
    // Raw SQL: brand_reference_images has no typed Prisma delegate yet (see brand.controller.ts).
    prisma.$queryRaw<Array<{ note: string | null }>>`SELECT note FROM brand_reference_images WHERE client_id = ${clientId} AND note IS NOT NULL LIMIT 10`,
  ]);

  return { profile, rules, products, services, personas, pillars, colors, fonts, referenceImages };
}

async function logGeneration(data: {
  agencyId: string; clientId?: string; contentId?: string; userId: string;
  taskType: string; input: any; output: any; status?: string; ai: AIProvider;
}) {
  const { provider, model } = data.ai.describe();
  await prisma.aiGeneration.create({
    data: {
      agencyId: data.agencyId,
      clientId: data.clientId,
      contentId: data.contentId,
      userId: data.userId,
      taskType: data.taskType,
      provider,
      model,
      input: JSON.stringify(data.input),
      output: JSON.stringify(data.output),
      status: data.status || 'COMPLETED',
    },
  }).catch(() => {}); // Non-blocking
}

export async function analyzeBrand(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const client = await prisma.client.findFirst({
      where: { id: clientId, agencyId: req.user!.agencyId },
      include: { brandProfile: true },
    });
    if (!client) throw new NotFoundError('Client not found');

    const ctx = await getBrandContext(clientId, req.user!.agencyId);
    const ai = await resolveAgencyAIProvider(req.user!.agencyId);

    const result = await ai.generateJSON<any>({
      systemPrompt: `Você é um especialista em branding e marketing digital.
Analise as informações da marca e retorne um JSON estruturado com:
{
  "brandSummary": string,
  "positioning": string,
  "targetAudience": string,
  "toneOfVoice": string,
  "personas": [{name, ageRange, description, painPoints, goals}],
  "contentPillars": [string],
  "brandRules": [{ruleType: "DO"|"DONT", ruleText: string}],
  "recommendedCtas": [string]
}`,
      userPrompt: `Cliente: ${client.name}
Descrição: ${client.description || 'Não informada'}
Segmento: ${client.industry || 'Não informado'}
Website: ${client.website || 'Não informado'}
Perfil atual: ${JSON.stringify(ctx.profile)}
Produtos: ${JSON.stringify(ctx.products.map(p => p.name))}
Serviços: ${JSON.stringify(ctx.services.map(s => s.name))}

Gere uma análise completa da marca.`,
    });

    await logGeneration({
      agencyId: req.user!.agencyId, clientId, userId: req.user!.id, ai,
      taskType: 'BRAND_ANALYSIS', input: { clientId }, output: result,
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function generateStrategy(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, month, year, objective } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const ctx = await getBrandContext(clientId, req.user!.agencyId);
    const ai = await resolveAgencyAIProvider(req.user!.agencyId);

    const result = await ai.generateJSON<any>({
      systemPrompt: `Você é um estrategista sênior de social media.
Crie uma estratégia mensal para a marca.
Retorne JSON: { "objective": string, "strategySummary": string, "recommendations": [{title, description, priority}] }`,
      userPrompt: `Marca: ${JSON.stringify(ctx.profile)}
Pilares: ${JSON.stringify(ctx.pillars.map(p => p.name))}
Objetivo do mês: ${objective || 'Crescimento e engajamento'}
Período: ${month || new Date().getMonth() + 1}/${year || new Date().getFullYear()}`,
    });

    await logGeneration({
      agencyId: req.user!.agencyId, clientId, userId: req.user!.id, ai,
      taskType: 'CONTENT_STRATEGY', input: req.body, output: result,
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function generateCalendar(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, month, year, postsCount = 12, reelsCount = 4, storiesCount = 8, objectives, specialDates } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const ctx = await getBrandContext(clientId, req.user!.agencyId);
    const ai = await resolveAgencyAIProvider(req.user!.agencyId);

    const result = await ai.generateJSON<any>({
      systemPrompt: `Você é um gestor sênior de social media.
Crie um calendário editorial completo.
Retorne JSON: {
  "strategy": { "objective": string, "strategySummary": string },
  "contents": [{
    "date": "YYYY-MM-DD",
    "type": "IMAGE|CAROUSEL|REEL|STORY|VIDEO",
    "pillar": string,
    "objective": string,
    "title": string,
    "brief": string,
    "hook": string,
    "captionDraft": string,
    "cta": string
  }]
}`,
      userPrompt: `Marca: ${ctx.profile?.brandSummary || 'Marca não configurada'}
Tom de voz: ${ctx.profile?.toneOfVoice || 'Profissional e próximo'}
Pilares: ${ctx.pillars.map(p => p.name).join(', ')}
Regras: ${ctx.rules.slice(0, 5).map(r => r.ruleText).join('; ')}

Mês: ${month || new Date().getMonth() + 1}, Ano: ${year || new Date().getFullYear()}
Posts: ${postsCount}, Reels: ${reelsCount}, Stories: ${storiesCount}
Objetivos: ${objectives || 'Engajamento e crescimento'}
Datas especiais: ${specialDates || 'Nenhuma'}`,
    });

    await logGeneration({
      agencyId: req.user!.agencyId, clientId, userId: req.user!.id, ai,
      taskType: 'CONTENT_IDEAS', input: req.body, output: result,
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function generateCaption(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, contentId, brief, contentType, platform, pillar, tone } = req.body;
    const ctx = clientId ? await getBrandContext(clientId, req.user!.agencyId) : null;
    const ai = await resolveAgencyAIProvider(req.user!.agencyId);

    const result = await ai.generateJSON<any>({
      systemPrompt: `Você é um copywriter sênior especialista em social media.
Crie uma legenda otimizada para a plataforma indicada.
Retorne JSON: { "caption": string, "hook": string, "cta": string, "hashtags": [string] }`,
      userPrompt: `Plataforma: ${platform || 'Instagram'}
Tipo: ${contentType || 'IMAGE'}
Pilar: ${pillar || 'ENGAGEMENT'}
Tom desejado: ${tone || 'Profissional e próximo'}
Brief: ${brief || 'Post de engajamento'}
Marca: ${ctx?.profile?.brandSummary || 'Marca geral'}
Tom de voz da marca: ${ctx?.profile?.toneOfVoice || 'Profissional'}
Regras: ${ctx?.rules.slice(0, 5).map(r => r.ruleText).join('; ') || 'Nenhuma'}`,
    });

    await logGeneration({
      agencyId: req.user!.agencyId, clientId, contentId, userId: req.user!.id, ai,
      taskType: 'CAPTION', input: req.body, output: result,
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function generateHook(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, brief, contentType, count = 3 } = req.body;
    const ai = await resolveAgencyAIProvider(req.user!.agencyId);

    const result = await ai.generateJSON<any>({
      systemPrompt: `Você é um copywriter expert em hooks virais para social media.
Retorne JSON: { "hooks": [string] }`,
      userPrompt: `Crie ${count} hooks poderosos para: ${brief}
Tipo de conteúdo: ${contentType || 'IMAGE'}`,
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function generateCta(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { brief, platform, objective, count = 5 } = req.body;
    const ai = await resolveAgencyAIProvider(req.user!.agencyId);

    const result = await ai.generateJSON<any>({
      systemPrompt: `Você é um especialista em CTAs para social media.
Retorne JSON: { "ctas": [string] }`,
      userPrompt: `Crie ${count} CTAs para: ${brief}
Plataforma: ${platform || 'Instagram'}
Objetivo: ${objective || 'Engajamento'}`,
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function generateHashtags(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, caption, industry, count = 15 } = req.body;
    const ai = await resolveAgencyAIProvider(req.user!.agencyId);

    const result = await ai.generateJSON<any>({
      systemPrompt: `Você é especialista em hashtags para Instagram e Facebook.
Retorne JSON: { "hashtags": [string], "branded": [string], "niche": [string] }`,
      userPrompt: `Crie ${count} hashtags relevantes para: ${caption}
Segmento: ${industry || 'Geral'}`,
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function rewrite(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { text, instruction, platform } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    const ai = await resolveAgencyAIProvider(req.user!.agencyId);

    const result = await ai.generateJSON<any>({
      systemPrompt: `Você é um copywriter expert. Reescreva o texto conforme a instrução.
Retorne JSON: { "rewritten": string }`,
      userPrompt: `Texto original: ${text}
Instrução: ${instruction || 'Melhore o texto'}
Plataforma: ${platform || 'Instagram'}`,
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function analyzeFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { feedbackText, clientId } = req.body;
    if (!feedbackText) return res.status(400).json({ error: 'feedbackText required' });
    const ai = await resolveAgencyAIProvider(req.user!.agencyId);

    const result = await ai.generateJSON<any>({
      systemPrompt: `Você é um especialista em análise de feedback de clientes para agências.
Analise o feedback e retorne JSON:
{
  "normalizedInstruction": string,
  "category": "COPY"|"DESIGN"|"TONE"|"COLOR"|"IMAGE"|"CTA"|"PRODUCT"|"OTHER",
  "sentiment": "POSITIVE"|"NEGATIVE"|"NEUTRAL",
  "isGlobalRule": boolean,
  "summary": string
}`,
      userPrompt: `Feedback do cliente: "${feedbackText}"`,
    });

    await logGeneration({
      agencyId: req.user!.agencyId, clientId, userId: req.user!.id, ai,
      taskType: 'FEEDBACK_NORMALIZATION', input: req.body, output: result,
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function generateImageProposal(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, contentId, brief, contentType, platform, hook: hookOverride, cta: ctaOverride } = req.body;
    if (!clientId || !brief) throw new ValidationError('clientId e brief são obrigatórios.');

    const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: req.user!.agencyId } });
    if (!client) throw new NotFoundError('Client not found');

    // Pull the real hook/cta off the content piece (when available) so the headline rendered
    // into the creative matches what will actually ship, instead of asking the caller to repeat it.
    const linkedContent = contentId
      ? await prisma.content.findFirst({
          where: { id: contentId, agencyId: req.user!.agencyId },
          select: { hook: true, cta: true },
        })
      : null;

    const ctx = await getBrandContext(clientId, req.user!.agencyId);
    const ai = await resolveAgencyAIProvider(req.user!.agencyId);

    const headline = String(hookOverride || linkedContent?.hook || '').trim();
    const ctaText = String(ctaOverride || linkedContent?.cta || '').trim();

    const colorNote = ctx.colors.length
      ? `Brand color palette (use each color strictly for its stated purpose): ${ctx.colors.map((c) => `${c.name} ${c.hex}${c.usageNotes ? ` → use as: ${c.usageNotes}` : ''}`).join('; ')}.`
      : '';
    const fontNote = ctx.fonts.length
      ? `Brand typography reference: ${ctx.fonts.map((f) => `${f.name}${f.usageNotes ? ` — ${f.usageNotes}` : ''}`).join(', ')}.`
      : '';
    // `as any`: visualStyleDescription was added via a hand-applied migration while `prisma
    // generate` couldn't reach binaries.prisma.sh, so the generated client's TS types don't
    // know about it yet — drop the cast once `prisma generate` runs with network access.
    const profileStyle = (ctx.profile as any)?.visualStyleDescription as string | null | undefined;
    const visualStyleNote = profileStyle
      ? `MANDATORY VISUAL STYLE — this overrides any generic design instinct, follow it precisely: ${profileStyle}`
      : '';
    const referenceNote = ctx.referenceImages.length
      ? `Reference mood board notes from the agency (match this look/feel): ${ctx.referenceImages.map((r) => r.note).join(' | ')}`
      : '';
    const contactNote = client.address
      ? `Available contact info (use only if the concept calls for a footer/contact card, e.g. a promotional flyer or store announcement — never force it onto a simple lifestyle post): Address: ${client.address}.${client.website ? ` Website: ${client.website}.` : ''}${client.phone ? ` Phone: ${client.phone}.` : ''}`
      : '';
    const logoNote = client.logoUrl
      ? `CRITICAL: The brand's real logo will be composited onto this image programmatically AFTER generation, as a badge in the bottom-left corner. You must leave the entire bottom-left corner region (roughly the bottom-left quarter of the image) completely EMPTY of any graphics, text, brand name, wordmark, or lettering — no exceptions, even a small one. Do not write or letter the brand name anywhere in the image, in that corner or elsewhere. Compose the rest of the design so it still looks balanced with that corner left clear.`
      : `This brand has no uploaded logo file — you may render a tasteful, minimal wordmark of the brand name if it fits the composition naturally, but do not fabricate an elaborate emblem.`;

    const isVertical = contentType === 'STORY' || contentType === 'REEL';
    const size: '1024x1024' | '1024x1536' = isVertical ? '1024x1536' : '1024x1024';
    const aspectNote = isVertical ? 'Vertical 9:16 full-bleed composition' : 'Square 1:1 composition';
    const cornerAvoidance = client.logoUrl ? ' Keep well clear of the bottom-left corner, which is reserved for the logo badge and must stay empty.' : '';

    const typographyBlock = headline
      ? `TYPOGRAPHY: Integrate this text directly into the design as a real graphic element — in Portuguese, exactly as written, with clean, highly legible, professionally kerned typography and a clear hierarchy (large bold headline, smaller supporting line). This must read like an actual branded template (Canva Pro / Freepik Premium quality), not a caption slapped on a photo.
Headline: "${headline}"
${ctaText ? `Secondary tag / CTA: "${ctaText}"` : ''}
Give the text generous margins, place it on a clean area of the composition,${cornerAvoidance} and add a subtle scrim, color block or gradient behind it only if needed for contrast/legibility. Align everything to a crisp grid.`
      : `No text overlay — deliver a clean, polished photographic or illustrative composition only, with visual space reserved for a caption to be added separately.${cornerAvoidance}`;

    const prompt = `
You are a senior graphic designer at a premium branding agency, producing finished, publish-ready social media creative at the quality level of Canva Pro templates, Freepik Premium assets, or a top-tier design studio — never a generic AI-generated image.

CONCEPT: ${brief}

BRAND: "${client.name}"${client.industry ? ` — ${client.industry}` : ''}
${ctx.profile?.positioning ? `Positioning: ${ctx.profile.positioning}` : ''}
${ctx.profile?.toneOfVoice ? `Brand voice/mood: ${ctx.profile.toneOfVoice}` : ''}
${ctx.profile?.brandPersonality ? `Brand personality: ${ctx.profile.brandPersonality}` : ''}
${visualStyleNote}
${referenceNote}
${colorNote}
${fontNote}
${contactNote}

FORMAT: ${aspectNote} for ${platform || 'Instagram'} ${CONTENT_TYPES_PT[contentType] || contentType || 'post'}.

LOGO: ${logoNote}

${typographyBlock}

ART DIRECTION: Intentional, professional composition (rule of thirds, deliberate negative space, balanced framing), the brand's own color palette applied to backgrounds/accents, cohesive lighting and color grading, premium editorial/advertising production value — the kind of visual a creative director would approve without revisions.

STRICTLY AVOID: generic "AI-generated" look, warped/illegible/duplicated text, extra or malformed limbs and faces, random watermarks or logos, cluttered composition, tired stock-photo clichés, inconsistent lighting, low production value.
`.trim();

    const image = await ai.generateImage(prompt, size);

    // Persist the proposal as a real Asset — the OpenAI image URL expires (~1h), and the mock
    // preview only exists as base64, so both need to land in our own storage to be reusable.
    let buffer: Buffer;
    let mimeType: string;
    if (image.url) {
      const imgRes = await fetch(image.url);
      buffer = Buffer.from(await imgRes.arrayBuffer());
      mimeType = imgRes.headers.get('content-type') || image.mimeType;
    } else {
      buffer = Buffer.from(image.b64!, 'base64');
      mimeType = image.mimeType;
    }

    // Composite the client's real logo onto the creative — pixel-accurate every time,
    // instead of relying on the image model to faithfully redraw an arbitrary brand mark.
    if (client.logoUrl) {
      try {
        const logoRes = await fetch(client.logoUrl);
        if (logoRes.ok) {
          const logoBuffer = Buffer.from(await logoRes.arrayBuffer());
          buffer = await compositeLogoOntoImage(buffer, logoBuffer);
          mimeType = 'image/png';
        }
      } catch {
        // Logo fetch/composite failed — ship the creative without it rather than failing the whole generation.
      }
    }

    const ext = mimeType === 'image/svg+xml' ? 'svg' : (mimeType.split('/')[1] || 'png');
    const { storageKey, publicUrl } = await getStorageProvider().upload(buffer, `ai-proposal.${ext}`, mimeType);

    const asset = await prisma.asset.create({
      data: {
        agencyId: req.user!.agencyId,
        clientId,
        uploadedBy: req.user!.id,
        type: 'IMAGE',
        name: `Proposta IA — ${brief.substring(0, 60)}`,
        mimeType,
        fileSize: buffer.length,
        storageKey,
        publicUrl,
        metadata: JSON.stringify({ aiGenerated: true, prompt, model: image.model, provider: image.provider }),
      },
    });

    // Attach directly to the content piece it was generated for, so it shows up in the workspace
    // preview and the client approval portal, not just as a floating asset in the client's library.
    if (contentId) {
      const content = await prisma.content.findFirst({ where: { id: contentId, agencyId: req.user!.agencyId } });
      if (content) {
        const sortOrder = await prisma.contentAsset.count({ where: { contentId } });
        await prisma.contentAsset.create({
          data: { agencyId: req.user!.agencyId, contentId, assetId: asset.id, role: 'PRIMARY', sortOrder },
        });
      }
    }

    await logGeneration({
      agencyId: req.user!.agencyId, clientId, contentId, userId: req.user!.id, ai,
      taskType: 'IMAGE_PROPOSAL', input: { clientId, contentId, brief, contentType, platform }, output: { prompt, assetId: asset.id },
    });

    res.json({ assetId: asset.id, url: asset.publicUrl, model: image.model, provider: image.provider, prompt });
  } catch (err) { next(err); }
}

// ─── AGENCY AI SETTINGS (bring-your-own API key) ───────────────────────────────

export async function getAiSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.agencyAiSettings.findUnique({ where: { agencyId: req.user!.agencyId } });
    if (!settings) {
      return res.json({ configured: false, provider: 'openai', textModel: 'gpt-4o-mini', imageModel: 'gpt-image-1' });
    }

    res.json({
      configured: true,
      provider: settings.provider,
      textModel: settings.textModel,
      imageModel: settings.imageModel,
      apiKeyMasked: maskSecret(decrypt(settings.apiKeyEncrypted)),
      updatedAt: settings.updatedAt,
    });
  } catch (err) { next(err); }
}

export async function saveAiSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { apiKey, provider = 'openai', textModel, imageModel } = req.body;
    if (!apiKey || String(apiKey).trim().length < 10) {
      throw new ValidationError('Informe uma chave de API válida.');
    }

    const trimmedKey = String(apiKey).trim();
    const settings = await prisma.agencyAiSettings.upsert({
      where: { agencyId: req.user!.agencyId },
      create: {
        agencyId: req.user!.agencyId,
        provider,
        apiKeyEncrypted: encrypt(trimmedKey),
        textModel: textModel || 'gpt-4o-mini',
        imageModel: imageModel || 'gpt-image-1',
      },
      update: {
        provider,
        apiKeyEncrypted: encrypt(trimmedKey),
        ...(textModel ? { textModel } : {}),
        ...(imageModel ? { imageModel } : {}),
      },
    });

    res.json({
      configured: true,
      provider: settings.provider,
      textModel: settings.textModel,
      imageModel: settings.imageModel,
      apiKeyMasked: maskSecret(trimmedKey),
      updatedAt: settings.updatedAt,
    });
  } catch (err) { next(err); }
}

export async function deleteAiSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.agencyAiSettings.deleteMany({ where: { agencyId: req.user!.agencyId } });
    res.json({ configured: false });
  } catch (err) { next(err); }
}

export async function testAiSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { apiKey, provider, textModel } = req.body;
    if (!apiKey) throw new ValidationError('Informe a chave de API para testar.');

    const ai = getAIProvider({ apiKey, provider, textModel });
    const result = await ai.generateText({
      systemPrompt: 'Responda apenas com a palavra: ok',
      userPrompt: 'teste de conexão',
      maxTokens: 5,
    });

    res.json({ success: true, ...ai.describe(), sample: result.text.trim() });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Falha ao conectar com o provedor de IA.' });
  }
}
