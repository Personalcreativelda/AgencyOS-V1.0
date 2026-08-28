// AI Provider abstraction — supports OpenAI, with mock fallback for dev

import { prisma } from '../../database/prisma';
import { decrypt } from '../../common/crypto';
import { AIProviderError } from '../../common/middleware/errorHandler';

// Builds a curated, user-safe AIProviderError from a failed provider HTTP response — extracts
// just the provider's own public-facing error message (e.g. "You have no credits remaining...",
// itself already meant to be shown to whoever holds the API key) instead of letting the raw
// response body reach the generic 500 handler, which would otherwise flatten it down to an
// unhelpful "Internal server error" and hide genuinely actionable problems like exhausted
// credits or an invalid key.
function providerError(providerLabel: string, rawBody: string): AIProviderError {
  try {
    const parsed = JSON.parse(rawBody);
    const msg = parsed?.error?.message || parsed?.error?.type;
    if (typeof msg === 'string' && msg.trim()) {
      return new AIProviderError(`${providerLabel}: ${msg}`);
    }
  } catch {
    // Not JSON (or unexpected shape) — fall through to the generic message below.
  }
  return new AIProviderError(`${providerLabel} não conseguiu processar a solicitação. Verifique a configuração da chave de IA em Configurações.`);
}

export interface AIRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  model: string;
  provider: string;
}

export interface AIImageResult {
  url?: string;
  b64?: string;
  mimeType: string;
  model: string;
  provider: string;
}

export type AIImageSize = '1024x1024' | '1024x1536' | '1536x1024';

// Providers that can actually generate images — used to validate task-routing assignments
// (Anthropic/Claude is text-only, so it can never be picked for the image task).
export const IMAGE_CAPABLE_PROVIDERS = ['openai', 'gemini'];

export interface AIImageInput {
  buffer: Buffer;
  mimeType: string;
}

export interface AIProvider {
  generateText(input: AIRequest): Promise<AIResponse>;
  generateJSON<T>(input: AIRequest): Promise<T>;
  generateImage(prompt: string, size?: AIImageSize): Promise<AIImageResult>;
  /** Vision analysis: looks at reference images and returns a text (typically JSON) description
   *  per `instructions` — used to distill a reference image's style into reusable text guidance
   *  instead of feeding the raw pixels into the generation call (which tends to get copied too
   *  literally). Not every provider generates images, but all of them can look at one. */
  analyzeImages(images: AIImageInput[], instructions: string): Promise<string>;
  describe(): { provider: string; model: string };
}

// Mock provider for development (no API key needed)
class MockAIProvider implements AIProvider {
  async generateText(input: AIRequest): Promise<AIResponse> {
    return {
      text: `[AI Mock] Response for: ${input.userPrompt.substring(0, 50)}...`,
      model: 'mock-1.0',
      provider: 'mock',
      inputTokens: 100,
      outputTokens: 50,
    };
  }

  async generateJSON<T>(input: AIRequest): Promise<T> {
    // Return sensible mock data based on system prompt hints
    const systemLower = input.systemPrompt.toLowerCase();

    if (systemLower.includes('brand') || systemLower.includes('marca')) {
      return {
        brandSummary: 'Marca inovadora focada em qualidade e experiência do cliente.',
        positioning: 'Premium e acessível',
        targetAudience: 'Adultos de 25-45 anos, classe média-alta',
        toneOfVoice: 'Profissional, próximo e inspirador',
        personas: [
          {
            name: 'Ana — A Profissional',
            ageRange: '28-38',
            description: 'Executiva que valoriza praticidade e qualidade',
            painPoints: ['Falta de tempo', 'Excesso de informação'],
            goals: ['Ser mais produtiva', 'Ter mais qualidade de vida'],
          },
        ],
        contentPillars: ['Educação', 'Produto', 'Lifestyle', 'Social Proof'],
        brandRules: [
          { ruleType: 'DO', ruleText: 'Usar linguagem próxima e empática' },
          { ruleType: 'DONT', ruleText: 'Evitar jargões técnicos excessivos' },
        ],
      } as T;
    }

    if (systemLower.includes('caption') || systemLower.includes('legenda')) {
      return {
        caption: '✨ Transforme o seu dia com quem entende o que você precisa.\n\nQualidade que faz diferença — porque você merece o melhor.\n\n💬 Deixa nos comentários: o que te faz escolher uma marca?',
        hook: 'E se você pudesse ter mais com menos esforço?',
        cta: 'Clique no link da bio e descubra!',
        hashtags: ['#qualidade', '#inovação', '#lifestyle', '#premium'],
      } as T;
    }

    if (systemLower.includes('strategy') || systemLower.includes('estratégia')) {
      return {
        objective: 'Aumentar engajamento e reconhecimento de marca',
        strategySummary: 'Foco em conteúdo educativo e de valor, com 40% educação, 30% produto e 30% social proof.',
        recommendations: [
          { title: 'Aumentar frequência de Reels', description: 'Reels têm 3x mais alcance que fotos estáticas', priority: 1 },
          { title: 'Criar série de conteúdo educativo', description: 'Posicionar a marca como autoridade no segmento', priority: 2 },
          { title: 'UGC e depoimentos', description: 'Social proof aumenta conversão em 70%', priority: 3 },
        ],
      } as T;
    }

    if (systemLower.includes('calendar') || systemLower.includes('calendário')) {
      const contents = [];
      const days = [2, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26, 29];
      const types = ['IMAGE', 'REEL', 'CAROUSEL', 'STORY', 'IMAGE', 'REEL'];
      const pillars = ['EDUCATION', 'PRODUCT', 'SOCIAL_PROOF', 'ENTERTAINMENT', 'INSTITUTIONAL'];

      for (let i = 0; i < 12; i++) {
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        contents.push({
          date: `${year}-${String(month).padStart(2, '0')}-${String(days[i]).padStart(2, '0')}`,
          type: types[i % types.length],
          pillar: pillars[i % pillars.length],
          objective: 'ENGAGEMENT',
          title: `Post ${i + 1} — ${pillars[i % pillars.length]}`,
          brief: 'Conteúdo gerado pela IA com base no perfil da marca.',
          hook: 'Você sabia que...',
          captionDraft: 'Draft de legenda gerado pela IA. Personalize antes de publicar.',
          cta: 'Comente abaixo!',
        });
      }

      return { strategy: { objective: 'Crescimento e engajamento' }, contents } as T;
    }

    return { result: 'Mock AI response - configure a chave de IA para respostas reais' } as T;
  }

  async generateImage(prompt: string, size: AIImageSize = '1024x1024'): Promise<AIImageResult> {
    // Zero-dependency placeholder: an inline SVG so mock mode never needs network access.
    const [w, h] = size.split('x');
    const label = prompt.substring(0, 60).replace(/[<>&]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect width="100%" height="100%" fill="#DFE3E8"/>
      <text x="50%" y="48%" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#637381">Prévia de Imagem (Mock)</text>
      <text x="50%" y="55%" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#919EAB">${label}</text>
    </svg>`;
    return {
      b64: Buffer.from(svg).toString('base64'),
      mimeType: 'image/svg+xml',
      model: 'mock-image-1.0',
      provider: 'mock',
    };
  }

  async analyzeImages(): Promise<string> {
    return JSON.stringify({
      colorPalette: ['tons neutros com um destaque de cor da marca'],
      typography: { style: 'sans-serif bold para headline', sizeHierarchy: 'headline grande, texto de apoio pequeno', weight: 'bold no título, regular no resto' },
      composition: 'grid centrado, espaço negativo generoso nas bordas',
      logoPlacement: 'canto inferior esquerdo, pequeno',
      mood: 'clean, moderno, profissional',
      recurringElements: ['fundo sólido', 'tipografia como elemento gráfico principal'],
    });
  }

  describe() {
    return { provider: 'mock', model: 'mock-1.0' };
  }
}

// OpenAI provider
class OpenAIProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private textModel = 'gpt-4o-mini',
    private imageModel = 'gpt-image-1'
  ) {}

  async generateText(input: AIRequest): Promise<AIResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.textModel,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw providerError('OpenAI', err);
    }

    const data = await response.json() as any;
    return {
      text: data.choices[0].message.content,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      model: this.textModel,
      provider: 'openai',
    };
  }

  async generateJSON<T>(input: AIRequest): Promise<T> {
    const response = await this.generateText({
      ...input,
      systemPrompt: input.systemPrompt + '\n\nSempre retorne SOMENTE JSON válido, sem markdown, sem texto extra.',
    });

    try {
      // Strip potential markdown code blocks
      const cleaned = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as T;
    } catch {
      throw new AIProviderError(`A IA retornou uma resposta em formato inválido: ${response.text.substring(0, 200)}`);
    }
  }

  async generateImage(prompt: string, size: AIImageSize = '1024x1024'): Promise<AIImageResult> {
    // dall-e-2 only supports square sizes — fall back rather than error on older accounts.
    const effectiveSize = this.imageModel === 'dall-e-2' ? '1024x1024' : size;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.imageModel,
        prompt,
        n: 1,
        size: effectiveSize,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw providerError('OpenAI', err);
    }

    const data = await response.json() as any;
    // gpt-image-1 returns b64_json (PNG) by default; dall-e-2/3 return a url — support both.
    return {
      url: data.data[0].url,
      b64: data.data[0].b64_json,
      mimeType: 'image/png',
      model: this.imageModel,
      provider: 'openai',
    };
  }

  async analyzeImages(images: AIImageInput[], instructions: string): Promise<string> {
    const content: any[] = [{ type: 'text', text: instructions }];
    for (const img of images.slice(0, 8)) {
      content.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.buffer.toString('base64')}` } });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.textModel,
        messages: [{ role: 'user', content }],
        temperature: 0.3,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw providerError('OpenAI', err);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content as string;
  }

  describe() {
    return { provider: 'openai', model: this.textModel };
  }
}

// Gemini (Google) provider — text via generateContent; image via the same endpoint on an
// image-capable model, requesting an image response modality (the current documented way to
// get Gemini to return generated image bytes, as opposed to Vertex AI's separate Imagen API).
class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private textModel = 'gemini-3.6-flash',
    private imageModel = 'gemini-2.5-flash-image'
  ) {}

  private async callGenerateContent(model: string, body: any) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!response.ok) {
      const err = await response.text();
      throw providerError('Gemini', err);
    }
    return response.json() as Promise<any>;
  }

  async generateText(input: AIRequest): Promise<AIResponse> {
    const data = await this.callGenerateContent(this.textModel, {
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
      generationConfig: { temperature: input.temperature ?? 0.7, maxOutputTokens: input.maxTokens ?? 2000 },
    });
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') || '';
    return {
      text,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      model: this.textModel,
      provider: 'gemini',
    };
  }

  async generateJSON<T>(input: AIRequest): Promise<T> {
    const response = await this.generateText({
      ...input,
      systemPrompt: input.systemPrompt + '\n\nSempre retorne SOMENTE JSON válido, sem markdown, sem texto extra.',
    });
    try {
      const cleaned = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as T;
    } catch {
      throw new AIProviderError(`A IA retornou uma resposta em formato inválido: ${response.text.substring(0, 200)}`);
    }
  }

  async generateImage(prompt: string): Promise<AIImageResult> {
    const data = await this.callGenerateContent(this.imageModel, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    });
    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
    if (!imagePart) throw new AIProviderError('Gemini não retornou uma imagem — verifique se o modelo configurado suporta geração de imagem.');
    return {
      b64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
      model: this.imageModel,
      provider: 'gemini',
    };
  }

  async analyzeImages(images: AIImageInput[], instructions: string): Promise<string> {
    const imageParts = images.slice(0, 8).map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.buffer.toString('base64') },
    }));
    const data = await this.callGenerateContent(this.textModel, {
      contents: [{ role: 'user', parts: [...imageParts, { text: instructions }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
    });
    return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') || '';
  }

  describe() {
    return { provider: 'gemini', model: this.textModel };
  }
}

// Anthropic (Claude) provider — text/JSON only. Claude models don't generate images; agencies
// on this provider need to keep OpenAI or Gemini configured elsewhere for image generation
// (there's no per-capability provider mixing yet — one provider serves the whole agency).
class AnthropicProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private textModel = 'claude-sonnet-5'
  ) {}

  async generateText(input: AIRequest): Promise<AIResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.textModel,
        system: input.systemPrompt,
        messages: [{ role: 'user', content: input.userPrompt }],
        max_tokens: input.maxTokens ?? 2000,
        temperature: input.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw providerError('Anthropic', err);
    }

    const data = await response.json() as any;
    return {
      text: data.content?.map((c: any) => c.text).filter(Boolean).join('') || '',
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      model: this.textModel,
      provider: 'anthropic',
    };
  }

  async generateJSON<T>(input: AIRequest): Promise<T> {
    const response = await this.generateText({
      ...input,
      systemPrompt: input.systemPrompt + '\n\nSempre retorne SOMENTE JSON válido, sem markdown, sem texto extra.',
    });
    try {
      const cleaned = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as T;
    } catch {
      throw new AIProviderError(`A IA retornou uma resposta em formato inválido: ${response.text.substring(0, 200)}`);
    }
  }

  async generateImage(): Promise<AIImageResult> {
    throw new AIProviderError('A Anthropic (Claude) não gera imagens. Configure OpenAI ou Gemini para gerar criativos com IA.');
  }

  async analyzeImages(images: AIImageInput[], instructions: string): Promise<string> {
    const content: any[] = images.slice(0, 8).map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: img.buffer.toString('base64') },
    }));
    content.push({ type: 'text', text: instructions });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.textModel,
        messages: [{ role: 'user', content }],
        max_tokens: 1200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw providerError('Anthropic', err);
    }

    const data = await response.json() as any;
    return data.content?.map((c: any) => c.text).filter(Boolean).join('') || '';
  }

  describe() {
    return { provider: 'anthropic', model: this.textModel };
  }
}

// Factory — pass `override` to use a specific (e.g. per-agency) provider/key instead of the
// server default. `provider` selects which class backs the AIProvider interface; every call
// site is provider-agnostic from here on.
let _defaultProvider: AIProvider | null = null;

export function getAIProvider(override?: {
  apiKey?: string; provider?: string; textModel?: string; imageModel?: string;
}): AIProvider {
  if (override?.apiKey) {
    if (override.provider === 'gemini') return new GeminiProvider(override.apiKey, override.textModel, override.imageModel);
    if (override.provider === 'anthropic') return new AnthropicProvider(override.apiKey, override.textModel);
    return new OpenAIProvider(override.apiKey, override.textModel, override.imageModel);
  }

  if (_defaultProvider) return _defaultProvider;

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.length > 10) {
    console.log('🤖 AI: Using OpenAI provider (server key)');
    _defaultProvider = new OpenAIProvider(apiKey, process.env.AI_MODEL || 'gpt-4o-mini');
  } else {
    console.log('🤖 AI: Using Mock provider (configure a chave de IA para respostas reais)');
    _defaultProvider = new MockAIProvider();
  }

  return _defaultProvider;
}

// Resolves the AI provider for an agency for a given task category. An agency can connect
// several providers at once (e.g. OpenAI + Gemini) and assign which one handles text tasks vs
// image tasks via Agency.aiTextProvider / Agency.aiImageProvider — the "agents" doing the work.
// If no assignment is set (or the assigned provider isn't connected), falls back to whichever
// connected provider comes first; if nothing is connected at all, falls back to the server-wide
// default (env var or mock). This is the single entry point controllers should use.
export async function resolveAgencyAIProvider(
  agencyId: string,
  task: 'text' | 'image' = 'text'
): Promise<AIProvider> {
  const [agency, allSettings] = await Promise.all([
    // `as any`: aiTextProvider/aiImageProvider were added via a hand-applied migration while
    // `prisma generate` couldn't reach binaries.prisma.sh — drop the cast once it runs with
    // network access.
    prisma.agency.findUnique({ where: { id: agencyId } }) as Promise<any>,
    prisma.agencyAiSettings.findMany({ where: { agencyId } }),
  ]);

  if (!allSettings.length) return getAIProvider();

  const preferredProvider = task === 'image' ? agency?.aiImageProvider : agency?.aiTextProvider;
  const settings =
    (preferredProvider && allSettings.find((s) => s.provider === preferredProvider)) || allSettings[0];

  try {
    const apiKey = decrypt(settings.apiKeyEncrypted);
    return getAIProvider({ apiKey, provider: settings.provider, textModel: settings.textModel, imageModel: settings.imageModel });
  } catch {
    // Decryption failed (e.g. ENCRYPTION_KEY rotated) — fall through to the server default.
    return getAIProvider();
  }
}

export const CONTENT_TYPES_PT: Record<string, string> = {
  IMAGE: 'Imagem',
  CAROUSEL: 'Carrossel',
  REEL: 'Reel / Vídeo Curto',
  STORY: 'Story',
  VIDEO: 'Vídeo',
  TEXT: 'Texto',
  ARTICLE: 'Artigo',
};
