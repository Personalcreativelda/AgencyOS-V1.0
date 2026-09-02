import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { resolveAgencyAIProvider, getAIProvider, AIProvider, AIImageInput, IMAGE_CAPABLE_PROVIDERS, CONTENT_TYPES_PT } from '../../integrations/ai/ai.provider';
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
    // publicUrl is fetched here (not just note) so image generation can actually look at the
    // reference creatives, not just a text description of them.
    prisma.$queryRaw<Array<{ note: string | null; publicUrl: string }>>`SELECT note, public_url as "publicUrl" FROM brand_reference_images WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 4`,
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
  "brandPersonality": string (2-4 adjetivos separados por vírgula, ex: "Autêntica, acolhedora, sofisticada"),
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

    // The 2000-token default (fine for a single caption) isn't nearly enough once the model has
    // to write title/brief/hook/captionDraft/cta for a whole month of items in one JSON blob —
    // it was running out of budget and truncating individual fields mid-sentence (e.g. a CTA
    // cut off with no ending). Scale the budget with how many items were actually requested.
    const totalItems = Number(postsCount) + Number(reelsCount) + Number(storiesCount);
    const maxTokens = Math.min(16000, Math.max(4000, totalItems * 350));

    const result = await ai.generateJSON<any>({
      systemPrompt: `Você é um gestor sênior de social media.
Crie um calendário editorial completo.
Cada campo de texto (hook, captionDraft, cta) deve ser uma frase COMPLETA e natural — nunca corte uma frase pela metade, mesmo que isso signifique escrever menos itens.
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
      maxTokens,
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
    const ai = await resolveAgencyAIProvider(req.user!.agencyId, 'text');

    // When this content already has a creative (uploaded or AI-generated), ground the caption
    // in what's actually visible in it — otherwise the copy can drift from the image (praising
    // an offer/product that isn't the one shown, describing a layout that doesn't exist), which
    // is exactly the "fora de contexto" problem this is meant to prevent. Picks the same "most
    // recent image asset" the workspace preview itself shows (see ContentDetailPage.tsx).
    let creativeImage: { buffer: Buffer; mimeType: string } | null = null;
    if (contentId) {
      const primaryAsset = await prisma.contentAsset.findFirst({
        where: { contentId, agencyId: req.user!.agencyId, asset: { mimeType: { startsWith: 'image/' } } },
        include: { asset: true },
        orderBy: { createdAt: 'desc' },
      });
      if (primaryAsset?.asset?.publicUrl) {
        try {
          const imgRes = await fetch(primaryAsset.asset.publicUrl);
          if (imgRes.ok) {
            creativeImage = { buffer: Buffer.from(await imgRes.arrayBuffer()), mimeType: primaryAsset.asset.mimeType };
          }
        } catch {
          // Image unreachable — fall through to text-only generation below rather than fail.
        }
      }
    }

    const systemPrompt = `Você é um copywriter sênior especialista em social media.
Crie uma legenda otimizada para a plataforma indicada.${creativeImage ? ' A imagem do criativo já pronto está anexada a esta mensagem — a legenda TEM que corresponder exatamente ao que está nela (produto, oferta, preço, texto visível na peça). Nunca escreva sobre algo diferente do que a imagem mostra.' : ''}
Retorne SOMENTE JSON, sem markdown, sem texto fora do JSON: { "caption": string, "hook": string, "cta": string, "hashtags": [string] }`;
    const userPrompt = `Plataforma: ${platform || 'Instagram'}
Tipo: ${contentType || 'IMAGE'}
Pilar: ${pillar || 'ENGAGEMENT'}
Tom desejado: ${tone || 'Profissional e próximo'}
Brief: ${brief || 'Post de engajamento'}
Marca: ${ctx?.profile?.brandSummary || 'Marca geral'}
Tom de voz da marca: ${ctx?.profile?.toneOfVoice || 'Profissional'}
Regras: ${ctx?.rules.slice(0, 5).map(r => r.ruleText).join('; ') || 'Nenhuma'}`;

    let result: any;
    if (creativeImage) {
      try {
        const raw = await ai.analyzeImages([creativeImage], `${systemPrompt}\n\n${userPrompt}`);
        result = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      } catch {
        // Vision call failed or didn't return clean JSON — fall back to the normal text-only
        // path rather than failing the whole request.
        result = await ai.generateJSON<any>({ systemPrompt, userPrompt });
      }
    } else {
      result = await ai.generateJSON<any>({ systemPrompt, userPrompt });
    }

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

// Distills the agency's reference/mood-board images into reusable style guidance as JSON text
// (color usage, typography scale, composition rules, recurring elements) via a vision call,
// instead of feeding the raw reference pixels into the generation call itself — which is what
// made earlier generations copy a specific reference's layout/logo/text too literally. The image
// model that actually draws the creative never sees these images; it only reads this summary.
async function analyzeReferenceStyle(
  ai: AIProvider,
  referenceImages: { note: string | null; publicUrl: string }[]
): Promise<string | null> {
  if (!referenceImages.length) return null;
  try {
    const images = (
      await Promise.all(
        referenceImages.slice(0, 4).map(async (r): Promise<AIImageInput | null> => {
          try {
            const res = await fetch(r.publicUrl);
            if (!res.ok) return null;
            const mimeType = res.headers.get('content-type') || 'image/png';
            const buffer = Buffer.from(await res.arrayBuffer());
            return { buffer, mimeType };
          } catch {
            return null;
          }
        })
      )
    ).filter((img): img is AIImageInput => !!img);
    if (!images.length) return null;

    const raw = await ai.analyzeImages(
      images,
      `These images are an agency's established creative template — the same brand posts this exact visual format repeatedly. Reverse-engineer the template as precise, actionable JSON so another designer could reproduce the SAME template with new content. Respond with ONLY JSON, no markdown, no text outside the JSON. Format:
{
  "colorPalette": "exact dominant colors (name + approximate hex if identifiable) and precisely which role each plays (background fill, accent, text)",
  "typography": { "style": "...", "sizeHierarchy": "precise scale relationships, e.g. headline fills ~30% of canvas height, one bold weight only", "weight": "...", "position": "where headline text is anchored, e.g. top-left third" },
  "composition": "the exact structural split — e.g. left 55% solid color with text block, right 45% subject photo bleeding to the edge; describe alignment/grid precisely, not generically",
  "logoPlacement": "exactly where brand marks appear and how many times — many templates repeat the logo (small icon in one corner AND a text wordmark elsewhere)",
  "iconRow": "if a row of small icons (social platforms, contact icons) appears, note its exact position (e.g. bottom edge, evenly spaced)",
  "accentShapes": "any recurring geometric/decorative shapes (blobs, circles, leaves, lightning bolts) and which corner/zone they occupy",
  "mood": "overall style, texture, lighting, atmosphere",
  "recurringElements": ["every element that repeats across the references, as specific as possible"]
}
Be concrete and specific (positions, proportions, counts) rather than vague adjectives — the goal is a reusable template spec, not a mood description. Do not describe the literal one-off photo content (which specific person, which specific object) — only the structural/style pattern around it.`
    );

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    JSON.parse(cleaned); // validate — throws if the model didn't return real JSON
    return cleaned;
  } catch {
    // Analysis failing (bad JSON, vision call error, unreachable image) should never block
    // generation — just proceed without style guidance from the references.
    return null;
  }
}

export async function generateImageProposal(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { clientId, contentId, brief, contentType, platform, hook: hookOverride } = req.body;
    if (!clientId || !brief) throw new ValidationError('clientId e brief são obrigatórios.');

    const client = await prisma.client.findFirst({ where: { id: clientId, agencyId: req.user!.agencyId } });
    if (!client) throw new NotFoundError('Client not found');

    // Pull the real hook off the content piece (when available) so the headline rendered
    // into the creative matches what will actually ship, instead of asking the caller to repeat it.
    // The CTA is deliberately NOT rendered into the image — it belongs in the post caption only.
    const linkedContent = contentId
      ? await prisma.content.findFirst({
          where: { id: contentId, agencyId: req.user!.agencyId },
          select: { hook: true },
        })
      : null;

    const ctx = await getBrandContext(clientId, req.user!.agencyId);
    const ai = await resolveAgencyAIProvider(req.user!.agencyId, 'image');

    const headline = String(hookOverride || linkedContent?.hook || '').trim();

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
    const referenceNoteTexts = ctx.referenceImages.map((r) => r.note).filter((n): n is string => !!n);
    const styleDNA = await analyzeReferenceStyle(ai, ctx.referenceImages);
    const referenceNote = styleDNA
      ? `BRAND TEMPLATE SPEC — this is the agency's established, repeating creative template, extracted from their own past posts. Follow it CLOSELY and CONSISTENTLY: match the color roles, typography scale/position, structural composition split, logo placement pattern, icon row (if any), and accent shapes described below as precisely as the concept allows — this creative should look unmistakably like the next post in the same series, not a generic departure from it. The only thing to avoid recreating exactly is the specific one-off photo subject, specific wording, or pixel-for-pixel layout of any single reference — the STRUCTURE and STYLE must match closely, only the content differs:\n${styleDNA}${referenceNoteTexts.length ? `\nAgency notes on these references: ${referenceNoteTexts.join(' | ')}` : ''}`
      : referenceNoteTexts.length
        ? `Reference mood board notes from the agency (use as loose stylistic inspiration only): ${referenceNoteTexts.join(' | ')}`
        : '';
    const contactNote = client.address
      ? `Available contact info (use only if the concept calls for a footer/contact card, e.g. a promotional flyer or store announcement — never force it onto a simple lifestyle post): Address: ${client.address}.${client.website ? ` Website: ${client.website}.` : ''}${client.phone ? ` Phone: ${client.phone}.` : ''}`
      : '';
    const logoNote = client.logoUrl
      ? `CRITICAL: The brand's real logo will be composited onto this image programmatically AFTER generation, as a badge in the bottom-left corner. You must leave the entire bottom-left corner region (roughly the bottom-left quarter of the image) completely EMPTY of any graphics, text, brand name, wordmark, or lettering — no exceptions, even a small one. Do not write, draw or letter the brand name, any logo mark, icon badge or wordmark ANYWHERE in the image, in that corner or elsewhere — the logo is handled entirely outside of your generation. Compose the rest of the design so it still looks balanced with that corner left clear.`
      : `CRITICAL: Do not draw, write or letter any logo, logo mark, icon badge or wordmark of the brand name anywhere in the image — no exceptions, even a small or minimal one. This creative must contain zero brand-mark elements; it is pure photographic/illustrative composition with typography only for the headline.`;

    const isVertical = contentType === 'STORY' || contentType === 'REEL';
    const size: '1024x1024' | '1024x1536' = isVertical ? '1024x1536' : '1024x1024';
    const aspectNote = isVertical ? 'Vertical 9:16 full-bleed composition' : 'Square 1:1 composition';
    const cornerAvoidance = client.logoUrl ? ' Keep well clear of the bottom-left corner, which is reserved for the logo badge and must stay empty.' : '';

    const typographyBlock = headline
      ? `TYPOGRAPHY: Integrate ONLY this headline text directly into the design as a real graphic element — in Portuguese, exactly as written, with clean, highly legible, professionally kerned typography. This must read like an actual branded template (Canva Pro / Freepik Premium quality), not a caption slapped on a photo. Do not add any other text, tag, badge or call-to-action to the image — the CTA lives in the post caption, not in the creative itself.
Headline: "${headline}"
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

PHOTOREALISM: Render this like it came from a real camera on a real shoot, not a synthetic render. If people appear: natural skin texture with visible pores, fine hairs and subtle asymmetry (not airbrushed-smooth or waxy), realistic individual hair strands, natural catchlights and slight imperfection in the eyes, true-to-life anatomy and proportions, relaxed/candid poses and expressions rather than stiff, perfectly symmetric ones. Use real photographic physics throughout: a believable lens (natural perspective, shallow depth of field where appropriate), directional lighting with soft realistic falloff and shadow, accurate color response — plus a touch of authentic texture/grain instead of a flawless digital sheen. This applies just as much to products, environments and illustrated elements: favor real-world material texture and lighting imperfection over a too-clean, too-perfect synthetic look.

STRICTLY AVOID: the telltale "AI-generated" look — waxy/plastic skin, uncanny-valley symmetry, glassy or dead-looking eyes, over-smoothed CGI render sheen, oversaturated HDR glow, generic stock-photo lighting; also avoid warped/illegible/duplicated text, extra or malformed limbs and faces, random watermarks or logos, cluttered composition, tired stock-photo clichés, inconsistent lighting, low production value.
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

// An agency can connect several providers at once (OpenAI, Gemini, Anthropic) and assign which
// one handles text tasks vs image tasks — the "agents" doing the work. `getAiSettings` returns
// every connected provider plus the current routing; `saveAiSettings` upserts one provider's
// key without touching the others; `deleteAiSettings` disconnects one and re-points routing that
// referenced it; `saveAiRouting` changes the text/image assignment.
export async function getAiSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [allSettings, agency] = await Promise.all([
      prisma.agencyAiSettings.findMany({ where: { agencyId: req.user!.agencyId }, orderBy: { createdAt: 'asc' } }),
      // `as any`: aiTextProvider/aiImageProvider were added via a hand-applied migration while
      // `prisma generate` couldn't reach binaries.prisma.sh — drop the cast once it runs with
      // network access.
      prisma.agency.findUnique({ where: { id: req.user!.agencyId } }) as Promise<any>,
    ]);

    const providers = allSettings.map((s) => ({
      provider: s.provider,
      textModel: s.textModel,
      imageModel: s.imageModel,
      imageCapable: IMAGE_CAPABLE_PROVIDERS.includes(s.provider),
      apiKeyMasked: maskSecret(decrypt(s.apiKeyEncrypted)),
      updatedAt: s.updatedAt,
    }));

    res.json({
      providers,
      textProvider: agency?.aiTextProvider || providers[0]?.provider || null,
      imageProvider: agency?.aiImageProvider || providers.find((p) => p.imageCapable)?.provider || null,
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
      // `as any`: composite unique `agencyId_provider` (from `@@unique([agencyId, provider])`)
      // isn't in the stale generated client types yet — see note above.
      where: { agencyId_provider: { agencyId: req.user!.agencyId, provider } } as any,
      create: {
        agencyId: req.user!.agencyId,
        provider,
        apiKeyEncrypted: encrypt(trimmedKey),
        textModel: textModel || 'gpt-4o-mini',
        imageModel: imageModel || 'gpt-image-1',
      },
      update: {
        apiKeyEncrypted: encrypt(trimmedKey),
        ...(textModel ? { textModel } : {}),
        ...(imageModel ? { imageModel } : {}),
      },
    });

    // First provider the agency ever connects becomes the default for both task categories,
    // so tasks have somewhere to go without forcing a separate routing step right away.
    const totalConnected = await prisma.agencyAiSettings.count({ where: { agencyId: req.user!.agencyId } });
    if (totalConnected === 1) {
      const data: any = { aiTextProvider: provider };
      if (IMAGE_CAPABLE_PROVIDERS.includes(provider)) data.aiImageProvider = provider;
      await prisma.agency.update({ where: { id: req.user!.agencyId }, data });
    }

    res.json({
      provider: settings.provider,
      textModel: settings.textModel,
      imageModel: settings.imageModel,
      imageCapable: IMAGE_CAPABLE_PROVIDERS.includes(settings.provider),
      apiKeyMasked: maskSecret(trimmedKey),
      updatedAt: settings.updatedAt,
    });
  } catch (err) { next(err); }
}

export async function deleteAiSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const provider = String(req.params.provider || '');
    if (!provider) throw new ValidationError('Informe o provedor a remover.');

    await prisma.agencyAiSettings.deleteMany({ where: { agencyId: req.user!.agencyId, provider } });

    const [agency, remaining] = await Promise.all([
      prisma.agency.findUnique({ where: { id: req.user!.agencyId } }) as Promise<any>,
      prisma.agencyAiSettings.findMany({ where: { agencyId: req.user!.agencyId } }),
    ]);

    // Re-point routing away from whatever was just disconnected, onto anything still connected.
    const data: any = {};
    if (agency?.aiTextProvider === provider) data.aiTextProvider = remaining[0]?.provider || null;
    if (agency?.aiImageProvider === provider) {
      data.aiImageProvider = remaining.find((s) => IMAGE_CAPABLE_PROVIDERS.includes(s.provider))?.provider || null;
    }
    if (Object.keys(data).length) await prisma.agency.update({ where: { id: req.user!.agencyId }, data });

    res.json({ removed: provider });
  } catch (err) { next(err); }
}

export async function saveAiRouting(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { textProvider, imageProvider } = req.body;
    const connected = await prisma.agencyAiSettings.findMany({ where: { agencyId: req.user!.agencyId } });
    const connectedProviders = connected.map((s) => s.provider);

    if (textProvider && !connectedProviders.includes(textProvider)) {
      throw new ValidationError('O provedor de texto escolhido não está conectado.');
    }
    if (imageProvider) {
      if (!connectedProviders.includes(imageProvider)) {
        throw new ValidationError('O provedor de imagem escolhido não está conectado.');
      }
      if (!IMAGE_CAPABLE_PROVIDERS.includes(imageProvider)) {
        throw new ValidationError('Esse provedor não gera imagens — escolha OpenAI ou Gemini.');
      }
    }

    const agency = await prisma.agency.update({
      where: { id: req.user!.agencyId },
      data: { aiTextProvider: textProvider || null, aiImageProvider: imageProvider || null } as any,
    });

    res.json({ textProvider: (agency as any).aiTextProvider, imageProvider: (agency as any).aiImageProvider });
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
