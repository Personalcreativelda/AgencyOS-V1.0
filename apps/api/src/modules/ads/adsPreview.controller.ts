import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/middleware/auth';
import { prisma } from '../../database/prisma';
import { decrypt } from '../../common/crypto';
import { NotFoundError, ValidationError } from '../../common/middleware/errorHandler';
import { GRAPH_URL, metaApiError } from '../../integrations/meta/metaClient';

/** Only pass HTTPS media URLs without API credentials to the browser. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.searchParams.has('access_token') ? url.toString() : null;
  } catch { return null; }
}
function metaLink(value: unknown): string | null {
  const url = safeUrl(value);
  if (!url) return null;
  return ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'instagram.com', 'www.instagram.com'].includes(new URL(url).hostname) ? url : null;
}

/** Meta returns HTML, but we never execute or send that markup to the client. Extract only its official frame. */
export function extractPreviewFrame(body: unknown): { url: string; height: number } | null {
  if (typeof body !== 'string') return null;
  const iframe = body.match(/<iframe\b[^>]*>/i)?.[0];
  const src = iframe?.match(/\ssrc\s*=\s*(["'])(.*?)\1/i)?.[2];
  if (!src) return null;
  const decoded = src.replace(/&amp;|&#38;|&#x26;/gi, '&');
  const url = safeUrl(decoded.startsWith('//') ? `https:${decoded}` : decoded);
  if (!url) return null;
  const parsed = new URL(url);
  if (!['www.facebook.com', 'facebook.com', 'm.facebook.com', 'business.facebook.com'].includes(parsed.hostname) || parsed.pathname !== '/ads/api/preview_iframe.php') return null;
  const height = Number(iframe?.match(/\sheight\s*=\s*["']?(\d+)/i)?.[1]) || 800;
  return { url, height: Math.max(300, Math.min(1200, height)) };
}

export async function getAdPreview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const adId = req.params.adId;
    if (!/^\d+$/.test(adId)) throw new ValidationError('Anúncio inválido.');
    const requestedWidth = Number(req.query.width ?? 500);
    if (!Number.isFinite(requestedWidth)) throw new ValidationError('Largura de preview inválida.');
    const width = Math.max(240, Math.min(500, Math.round(requestedWidth)));
    const connection = await prisma.socialConnection.findFirst({ where: { id: req.params.id, agencyId: req.user!.agencyId, platform: 'META_ADS' } });
    if (!connection?.accessTokenEncrypted || !connection.externalPageId) throw new NotFoundError('Conta de anúncios não encontrada ou desconectada.');
    const token = decrypt(connection.accessTokenEncrypted);
    const read = async (path: string, fields: Record<string, string>) => {
      const response = await fetch(`${GRAPH_URL}/${path}?` + new URLSearchParams({ ...fields, access_token: token }), { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw await metaApiError(response);
      return response.json() as Promise<any>;
    };
    // Verify the ad belongs to this tenant's selected account before requesting previews or video.
    const ad = await read(adId, { fields: 'id,account_id,name,preview_shareable_link,creative{body,title,call_to_action_type,effective_object_story_id,effective_instagram_media_id,instagram_permalink_url,video_id,object_story_spec}' });
    if (ad.account_id !== connection.externalPageId.replace(/^act_/, '')) throw new NotFoundError('Anúncio não encontrado nesta conta.');
    const creative = ad.creative || {};
    const story = creative.object_story_spec || {};
    const videoId = creative.video_id || story.video_data?.video_id;
    // Either resource can be unavailable independently (e.g. Page/video permissions or unsupported placement).
    const [previewResult, videoResult, instagramResult] = await Promise.allSettled([
      read(`${adId}/previews`, { ad_format: 'MOBILE_FEED_STANDARD', width: String(width), height: '800' }),
      /^\d+$/.test(videoId || '') ? read(videoId, { fields: 'source' }) : Promise.resolve(null),
      /^\d+$/.test(creative.effective_instagram_media_id || '') ? read(creative.effective_instagram_media_id, { fields: 'media_type,media_url' }) : Promise.resolve(null),
    ]);
    const frame = previewResult.status === 'fulfilled' ? extractPreviewFrame(previewResult.value?.data?.[0]?.body) : null;
    // Boosted Instagram videos often omit the Facebook Video.source field.
    const instagramVideo = instagramResult.status === 'fulfilled' && instagramResult.value?.media_type === 'VIDEO' ? safeUrl(instagramResult.value.media_url) : null;
    const videoUrl = (videoResult.status === 'fulfilled' ? safeUrl(videoResult.value?.source) : null) || instagramVideo;
    const storyId = typeof creative.effective_object_story_id === 'string' && /^\d+_\d+$/.test(creative.effective_object_story_id) ? creative.effective_object_story_id.split('_') : null;
    const postUrl = metaLink(ad.preview_shareable_link) || metaLink(creative.instagram_permalink_url) || (storyId ? `https://www.facebook.com/${storyId[0]}/posts/${storyId[1]}` : null);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      adId, iframeUrl: frame?.url || null, iframeHeight: frame?.height || 800, width,
      videoUrl, isVideo: Boolean(videoId || instagramVideo), postUrl,
      text: creative.body || story.video_data?.message || story.link_data?.message || story.photo_data?.caption || null,
      title: creative.title || story.link_data?.name || null,
      callToAction: creative.call_to_action_type || story.link_data?.call_to_action?.type || story.video_data?.call_to_action?.type || null,
    });
  } catch (err) { next(err); }
}
