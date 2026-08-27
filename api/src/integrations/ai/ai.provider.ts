// AI Provider abstraction — supports OpenAI, with mock fallback for dev

import { prisma } from '../../database/prisma';
import { decrypt } from '../../common/crypto';

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

export interface AIProvider {
  generateText(input: AIRequest): Promise<AIResponse>;
  generateJSON<T>(input: AIRequest): Promise<T>;
  generateImage(prompt: string, size?: AIImageSize): Promise<AIImageResult>;
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
      throw new Error(`OpenAI API error: ${err}`);
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
      throw new Error(`AI returned invalid JSON: ${response.text.substring(0, 200)}`);
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
      throw new Error(`OpenAI Images API error: ${err}`);
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

  describe() {
    return { provider: 'openai', model: this.textModel };
  }
}

// Factory — pass `override` to use a specific (e.g. per-agency) API key instead of the server default.
let _defaultProvider: AIProvider | null = null;

export function getAIProvider(override?: { apiKey?: string; textModel?: string; imageModel?: string }): AIProvider {
  if (override?.apiKey) {
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

// Resolves the AI provider for an agency: its own configured key first, falling back to the
// server-wide default (env var or mock). This is the single entry point controllers should use.
export async function resolveAgencyAIProvider(agencyId: string): Promise<AIProvider> {
  const settings = await prisma.agencyAiSettings.findUnique({ where: { agencyId } });

  if (settings?.apiKeyEncrypted) {
    try {
      const apiKey = decrypt(settings.apiKeyEncrypted);
      return getAIProvider({ apiKey, textModel: settings.textModel, imageModel: settings.imageModel });
    } catch {
      // Decryption failed (e.g. ENCRYPTION_KEY rotated) — fall through to the server default.
    }
  }

  return getAIProvider();
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
