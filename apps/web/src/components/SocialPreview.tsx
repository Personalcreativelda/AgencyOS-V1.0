import { useEffect, useState } from 'react'
import {
  Sparkles, Globe, ThumbsUp, ThumbsDown, MessageCircle, Share2, Heart, Send, Bookmark, MoreHorizontal,
  Loader2, Repeat2, Music2, Eye, ChevronLeft, ChevronRight, MoreVertical, Plus, Megaphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar'

export type SocialPlatform = 'INSTAGRAM' | 'FACEBOOK' | 'STORY' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE' | 'WHATSAPP'

// Only shows a tab for a network actually selected for this content — no tab is shown "just in
// case." Facebook/Instagram/Stories are the one exception where selecting one network still
// implies a second tab (Instagram also gets a Stories tab, since Stories is a format of
// Instagram, not a separate network in the picker). WHATSAPP here means posting to the client's
// own WhatsApp Status (a per-client Evolution API connection) — a real publishable network like
// the others, NOT the agency's own "share this creative with the client for approval" channel
// (that one lives in the page header as its own button, unrelated to this tab system). X isn't
// included yet — no publish integration built for it yet; add it here once there is.
function computeVisibleTabs(selected: string[]): SocialPlatform[] {
  const tabs: SocialPlatform[] = []
  if (selected.includes('INSTAGRAM')) tabs.push('INSTAGRAM', 'STORY')
  if (selected.includes('FACEBOOK')) tabs.push('FACEBOOK')
  if (selected.includes('LINKEDIN')) tabs.push('LINKEDIN')
  if (selected.includes('TIKTOK')) tabs.push('TIKTOK')
  if (selected.includes('YOUTUBE')) tabs.push('YOUTUBE')
  if (selected.includes('WHATSAPP')) tabs.push('WHATSAPP')
  return tabs
}

interface SocialPreviewProps {
  clientName?: string | null
  clientLogoUrl?: string | null
  title: string
  hook?: string | null
  caption?: string | null
  cta?: string | null
  /** The full Asset — mimeType is what decides image vs video rendering below. Ignored when
   *  `mediaList` has items; kept as the single-media fallback for callers that don't pass it. */
  image?: { publicUrl: string; mimeType?: string } | null
  /** All of the content's current media, in carousel order (role: 'PRIMARY', sorted by
   *  sortOrder). 2+ image items enables carousel navigation on Instagram/Facebook/LinkedIn/
   *  WhatsApp — TikTok/YouTube/Stories always show just the first item regardless, since none
   *  of those support multi-image posts. */
  mediaList?: Array<{ publicUrl: string; mimeType?: string }>

  /** true while the AI is generating/regenerating the creative image — shows a loading
   *  animation over the preview so it's obvious the process is still running (instead of
   *  the person navigating away thinking it silently finished or failed). */
  generating?: boolean
  /** 0-100 while a manual file upload is in progress — shows the same overlay as `generating`
   *  but with the actual upload percentage, so it's obvious the request is still going instead
   *  of looking like nothing happened (especially for larger video files). */
  uploadProgress?: number | null
  /** Raw ContentPlatform.platform values actually selected for this content (e.g.
   *  ['INSTAGRAM','TIKTOK']) — drives which tabs are offered. None selected yet → an empty
   *  state asking to pick a network, rather than guessing one. */
  selectedPlatforms?: string[]
  defaultPlatform?: SocialPlatform
  /** Controlled mode — pass both to let the parent know/drive which tab is active
   *  (e.g. the workspace uses this to show a matching "Publicar no X" button). */
  value?: SocialPlatform
  onChange?: (platform: SocialPlatform) => void
  /** true when embedded on a fixed-dark page (e.g. the public approval portal) so the tab
   *  switcher's own chrome matches — the phone mockups below are always fixed-appearance. */
  dark?: boolean
}

const TAB_LABELS: Record<SocialPlatform, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  STORY: 'Stories',
  LINKEDIN: 'LinkedIn',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  WHATSAPP: 'WhatsApp Status',
}

// Fixed slate tones (not our theme-reactive `grey`) — this simulates a real phone screenshot,
// so it must look the same regardless of whether the surrounding app is in light or dark mode.
function GeneratingOverlay({ overImage, title, subtitle }: { overImage: boolean; title: string; subtitle: string }) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-center px-4',
        overImage ? 'bg-[#000]/60 backdrop-blur-sm' : ''
      )}
    >
      <div className="relative w-12 h-12 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
        <div className="relative w-12 h-12 rounded-full bg-[#fff]/10 flex items-center justify-center backdrop-blur-md border border-[#fff]/20">
          <Loader2 size={20} className="text-primary-light animate-spin" />
        </div>
      </div>
      <p className="text-xs font-extrabold text-[#fff]">{title}</p>
      <p className="text-[10px] text-slate-300 font-medium">{subtitle}</p>
    </div>
  )
}

// Arrows + dot indicators for stepping through a carousel (2+ images) — used by Instagram,
// Facebook, LinkedIn and WhatsApp Status, the networks that actually support a multi-image
// post. Purely a preview affordance (click-through, not swipe) — enough to show "this is a
// carousel" without building real drag gestures for a static mockup.
function CarouselOverlay({ count, index, onChange }: { count: number; index: number; onChange: (i: number) => void }) {
  if (count <= 1) return null
  return (
    <>
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(index - 1) }}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-[#000]/50 hover:bg-[#000]/70 flex items-center justify-center text-[#fff] transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
      )}
      {index < count - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(index + 1) }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-[#000]/50 hover:bg-[#000]/70 flex items-center justify-center text-[#fff] transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      )}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={cn('rounded-full transition-all', i === index ? 'w-3.5 h-1.5 bg-[#fff]' : 'w-1.5 h-1.5 bg-[#fff]/50')} />
        ))}
      </div>
      <span className="absolute top-2 right-2 z-20 bg-[#000]/50 text-[#fff] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
        {index + 1}/{count}
      </span>
    </>
  )
}

function PreviewMedia({
  image, title, hook, aspect, fill, generating, uploadProgress, contain,
}: {
  image: { publicUrl: string; mimeType?: string } | null; title: string; hook?: string | null; aspect?: string; fill?: boolean;
  generating?: boolean; uploadProgress?: number | null;
  /** letterbox instead of crop — used by the YouTube player, which shows any aspect ratio
   *  on a black background rather than cropping to fill, matching the real YouTube player. */
  contain?: boolean;
}) {
  const wrapperClass = fill ? 'absolute inset-0' : `relative w-full ${aspect || ''}`
  const uploading = uploadProgress != null
  const overlay = uploading
    ? { title: `Enviando arquivo... ${uploadProgress}%`, subtitle: 'Não feche esta página até o envio terminar.' }
    : { title: 'Gerando criativo com IA...', subtitle: 'Isso pode levar até 1 minuto — não feche esta página.' }

  if (image) {
    const isVideo = image.mimeType?.startsWith('video/')
    const fitClass = contain ? 'object-contain' : 'object-cover'
    return (
      <div className={`${wrapperClass} overflow-hidden ${contain ? 'bg-[#000]' : ''}`}>
        {isVideo ? (
          <video src={image.publicUrl} className={`w-full h-full ${fitClass}`} autoPlay muted loop playsInline />
        ) : (
          <img src={image.publicUrl} alt={title} className={`w-full h-full ${fitClass}`} />
        )}
        {!fill && !contain && <Badge variant="primary" className="absolute top-2.5 left-2.5">Criativo</Badge>}
        {(generating || uploading) && <GeneratingOverlay overImage {...overlay} />}
      </div>
    )
  }

  return (
    <div className={`${wrapperClass} bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-center text-[#fff]`}>
      {generating || uploading ? (
        <GeneratingOverlay overImage={false} {...overlay} />
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-[#fff]/10 flex items-center justify-center mb-3 backdrop-blur-md border border-[#fff]/20">
            <Sparkles size={24} className="text-primary-light" />
          </div>
          <p className="text-sm font-extrabold max-w-xs">{title}</p>
          {hook && <p className="text-xs text-slate-300 mt-2 italic max-w-xs font-medium">"{hook}"</p>}
        </>
      )}
    </div>
  )
}

// Highlights #hashtags the way Instagram/Facebook render them in a real caption.
function renderCaption(caption?: string | null) {
  if (!caption) return <span className="text-slate-400 italic">Sem legenda ainda...</span>
  return caption.split(/(#[\p{L}0-9_]+)/gu).map((part, i) =>
    part.startsWith('#') ? (
      <span key={i} className="text-[#00376B] font-semibold">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export function SocialPreview({
  clientName, clientLogoUrl, title, hook, caption, cta, image = null, mediaList, generating = false, uploadProgress = null,
  selectedPlatforms = [], defaultPlatform = 'INSTAGRAM', value, onChange, dark = false,
}: SocialPreviewProps) {
  const [internalPlatform, setInternalPlatform] = useState<SocialPlatform>(defaultPlatform)
  const visibleTabs = computeVisibleTabs(selectedPlatforms)
  const requestedPlatform = value ?? internalPlatform
  // Falls back to the first available tab if the one currently selected no longer applies
  // (e.g. the user was on the TikTok tab and then unchecked TikTok in the platform picker).
  const platform = visibleTabs.includes(requestedPlatform) ? requestedPlatform : visibleTabs[0]
  const setPlatform = onChange ?? setInternalPlatform
  const clientHandle = clientName?.toLowerCase().replace(/\s+/g, '') || 'cliente'
  const clientInitial = clientName?.[0] || 'C'

  const resolvedMedia = mediaList && mediaList.length > 0 ? mediaList : (image ? [image] : [])
  const [slideIndex, setSlideIndex] = useState(0)
  // Clamped rather than reset via effect — simplest way to stay valid whenever the platform tab
  // or the underlying media set changes size (e.g. switching to a tab with fewer/no slides).
  const activeSlideIndex = Math.min(slideIndex, Math.max(resolvedMedia.length - 1, 0))
  const currentMedia = resolvedMedia[activeSlideIndex] || null
  const firstMedia = resolvedMedia[0] || null

  // Keeps the parent's controlled `value` in sync when the fallback above silently switches
  // the displayed tab (e.g. the platform picker changed out from under an already-open
  // Workspace) — without this, the mockup shown here and a parent-side "Publicar no X" button
  // driven by the same `value` could end up pointing at two different networks.
  useEffect(() => {
    if (visibleTabs.length > 0 && platform !== requestedPlatform) setPlatform(platform)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, requestedPlatform])

  if (visibleTabs.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-dashed p-8 text-center', dark ? 'border-[#fff]/15' : 'border-border')}>
        <p className={cn('text-xs font-bold', dark ? 'text-grey-400' : 'text-muted-foreground')}>
          Selecione uma rede social para ver o preview de publicação.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Note: Tailwind's `white`/`black` keywords are remapped to our reactive grey scale
         (see tailwind.config.ts), so anywhere a *literal*, theme-independent white/black is
         needed (here, and in the fixed phone mockups below) we use `#fff`/`#000` directly. */}
      <div className={cn('flex items-center gap-1 rounded-xl p-1 overflow-x-auto', dark ? 'bg-[#fff]/10' : 'bg-grey-100')}>
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setPlatform(tab)}
            className={cn(
              'flex-1 rounded-lg px-2 py-2 text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all',
              platform === tab
                ? dark ? 'bg-[#fff]/15 text-[#fff]' : 'bg-[#fff] text-grey-800 shadow-z1'
                : dark ? 'text-grey-400 hover:text-[#fff]' : 'text-grey-500 hover:text-grey-700'
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Instagram Feed */}
      {platform === 'INSTAGRAM' && (
        <div className="bg-[#fff] border border-slate-200 rounded-2xl overflow-hidden shadow-card max-w-sm mx-auto">
          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8">
                {clientLogoUrl && <AvatarImage src={clientLogoUrl} />}
                <AvatarFallback className="bg-primary/20 text-primary-dark text-xs">{clientInitial}</AvatarFallback>
              </Avatar>
              <p className="text-xs font-bold text-slate-800 leading-none">{clientHandle}</p>
            </div>
            <MoreHorizontal size={18} className="text-slate-700" />
          </div>

          <div className="relative">
            <PreviewMedia image={currentMedia} title={title} hook={hook} aspect="aspect-square" generating={generating} uploadProgress={uploadProgress} />
            <CarouselOverlay count={resolvedMedia.length} index={activeSlideIndex} onChange={setSlideIndex} />
          </div>

          <div className="flex items-center justify-between px-3.5 pt-3">
            <div className="flex items-center gap-3.5 text-slate-800">
              <Heart size={22} strokeWidth={1.8} />
              <MessageCircle size={21} strokeWidth={1.8} />
              <Send size={20} strokeWidth={1.8} />
            </div>
            <Bookmark size={20} strokeWidth={1.8} className="text-slate-800" />
          </div>

          <div className="p-4 pt-2 space-y-1.5 text-xs">
            <p className="font-bold text-slate-800">Seja o primeiro a curtir</p>
            <div className="leading-relaxed whitespace-pre-line text-slate-800 font-medium">
              <span className="font-bold mr-1.5">{clientHandle}</span>
              {renderCaption(caption)}
            </div>
            {cta && <p className="font-bold text-primary">{cta}</p>}
          </div>
        </div>
      )}

      {/* Facebook Feed */}
      {platform === 'FACEBOOK' && (
        <div className="bg-[#fff] border border-slate-200 rounded-2xl overflow-hidden shadow-card max-w-sm mx-auto">
          <div className="flex items-center gap-2.5 p-3.5">
            <Avatar className="h-9 w-9">
              {clientLogoUrl && <AvatarImage src={clientLogoUrl} />}
              <AvatarFallback className="bg-[#1877F2]/15 text-[#1877F2] text-xs">{clientInitial}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 leading-none truncate">{clientName}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                Agora <Globe size={10} />
              </p>
            </div>
            <MoreHorizontal size={18} className="text-slate-700" />
          </div>

          <div className="px-3.5 pb-3 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-medium">
            {renderCaption(caption)}
          </div>

          <div className="relative">
            <PreviewMedia image={currentMedia} title={title} hook={hook} aspect="aspect-square" generating={generating} uploadProgress={uploadProgress} />
            <CarouselOverlay count={resolvedMedia.length} index={activeSlideIndex} onChange={setSlideIndex} />
          </div>

          <div className="flex items-center gap-1.5 px-3.5 py-2 text-[11px] text-slate-500 font-medium border-b border-slate-100">
            <span className="w-4 h-4 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
              <ThumbsUp size={9} className="text-[#fff]" fill="currentColor" />
            </span>
            <span>Seja o primeiro a reagir</span>
          </div>

          <div className="flex items-center justify-around py-2.5 text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><ThumbsUp size={14} /> Curtir</span>
            <span className="flex items-center gap-1.5"><MessageCircle size={14} /> Comentar</span>
            <span className="flex items-center gap-1.5"><Share2 size={14} /> Compartilhar</span>
          </div>
        </div>
      )}

      {/* Stories / Reels */}
      {platform === 'STORY' && (
        <div className="relative w-full max-w-[220px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 shadow-card">
          <div className="absolute top-2 left-2 right-2 h-0.5 bg-[#fff]/30 rounded-full overflow-hidden z-10">
            <div className="h-full w-full bg-[#fff]" />
          </div>
          <div className="absolute top-5 left-2.5 right-2.5 flex items-center gap-1.5 z-10">
            <Avatar className="h-6 w-6 ring-1 ring-[#fff]/50">
              {clientLogoUrl && <AvatarImage src={clientLogoUrl} />}
              <AvatarFallback className="bg-primary/40 text-[#fff] text-[9px]">{clientInitial}</AvatarFallback>
            </Avatar>
            <span className="text-[11px] font-bold text-[#fff] drop-shadow">{clientHandle}</span>
            <span className="text-[10px] text-[#fff]/70">agora</span>
          </div>

          <PreviewMedia image={firstMedia} title={title} hook={hook} fill generating={generating} uploadProgress={uploadProgress} />

          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#000]/70 via-[#000]/20 to-transparent">
            {hook && <p className="text-[11px] text-[#fff]/90 italic mb-1 line-clamp-2">"{hook}"</p>}
            {cta && <p className="text-xs font-extrabold text-[#fff]">{cta}</p>}
          </div>
        </div>
      )}

      {/* WhatsApp Status — a real publishable network (per-client Evolution API connection),
         posted as a Status on the client's own WhatsApp. Modeled directly on how WhatsApp
         itself shows a posted Status (viewing "My status"): a solid dark header bar (back /
         avatar with a "+" badge / "O meu estado" / timestamp / menu) — NOT text overlaid on the
         image like Instagram/TikTok Stories — the media letterboxed on black below it (WhatsApp
         doesn't crop to fill), then caption + view count + "Promover" in a solid footer, also
         not overlaid. */}
      {platform === 'WHATSAPP' && (
        <div className="relative w-full max-w-[220px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-[#000] shadow-card flex flex-col">
          <div className="absolute top-1.5 left-1.5 right-1.5 h-0.5 bg-[#fff]/25 rounded-full overflow-hidden z-10">
            <div className="h-full w-[92%] bg-[#fff]" />
          </div>

          <div className="relative z-10 flex items-center gap-2 px-2.5 pt-4 pb-2.5 shrink-0">
            <ChevronLeft size={15} className="text-[#fff]/90 shrink-0" />
            <div className="relative shrink-0">
              <Avatar className="h-7 w-7">
                {clientLogoUrl && <AvatarImage src={clientLogoUrl} />}
                <AvatarFallback className="bg-[#25D366]/40 text-[#fff] text-[9px]">{clientInitial}</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#25D366] flex items-center justify-center ring-2 ring-[#000]">
                <Plus size={7} className="text-[#fff]" strokeWidth={3} />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#fff] leading-tight truncate">O meu estado</p>
              <p className="text-[9px] text-[#fff]/60">agora</p>
            </div>
            <MoreVertical size={13} className="text-[#fff]/80 shrink-0" />
          </div>

          <div className="relative flex-1 min-h-0 bg-[#000]">
            <PreviewMedia image={currentMedia} title={title} hook={hook} fill generating={generating} uploadProgress={uploadProgress} contain />
            <CarouselOverlay count={resolvedMedia.length} index={activeSlideIndex} onChange={setSlideIndex} />
          </div>

          <div className="relative z-10 shrink-0 bg-[#111b21] px-2.5 pt-2 pb-2 space-y-1.5">
            {(caption || hook) && (
              <p className="text-[10px] text-[#fff]/90 leading-snug line-clamp-2">
                {caption || hook} <span className="text-[#fff]/50 font-bold">Ler mais</span>
              </p>
            )}
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-[9px] font-bold text-[#fff]/70 bg-[#fff]/10 rounded-full px-2 py-1">
                <Eye size={9} /> 0 visualizações
              </span>
              <span className="flex items-center gap-1 text-[9px] font-bold text-[#fff]/70 bg-[#fff]/10 rounded-full px-2 py-1">
                <Megaphone size={9} /> Promover
              </span>
              <Share2 size={12} className="text-[#fff]/70 ml-auto" />
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn Feed — Company Page post. Unlike Instagram/Facebook, LinkedIn shows the
         caption ABOVE the media, and the avatar is rounded-square (a Page logo), not circular. */}
      {platform === 'LINKEDIN' && (
        <div className="bg-[#fff] border border-slate-200 rounded-2xl overflow-hidden shadow-card max-w-sm mx-auto">
          <div className="flex items-start gap-2.5 p-3.5">
            <Avatar className="h-11 w-11 rounded-lg shrink-0">
              {clientLogoUrl && <AvatarImage src={clientLogoUrl} className="rounded-lg" />}
              <AvatarFallback className="bg-[#0A66C2]/15 text-[#0A66C2] text-xs rounded-lg">{clientInitial}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 leading-tight truncate">{clientName}</p>
              <p className="text-[10px] text-slate-500 font-medium">1.234 seguidores</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                Agora <Globe size={10} />
              </p>
            </div>
            <MoreHorizontal size={18} className="text-slate-700 shrink-0" />
          </div>

          <div className="px-3.5 pb-3 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-medium">
            {renderCaption(caption)}
          </div>

          <div className="relative">
            <PreviewMedia image={currentMedia} title={title} hook={hook} aspect="aspect-square" generating={generating} uploadProgress={uploadProgress} />
            <CarouselOverlay count={resolvedMedia.length} index={activeSlideIndex} onChange={setSlideIndex} />
          </div>

          <div className="flex items-center justify-around py-2.5 text-[11px] font-bold text-slate-500 border-t border-slate-100 mt-1">
            <span className="flex items-center gap-1.5"><ThumbsUp size={14} /> Gostei</span>
            <span className="flex items-center gap-1.5"><MessageCircle size={14} /> Comentar</span>
            <span className="flex items-center gap-1.5"><Repeat2 size={14} /> Republicar</span>
            <span className="flex items-center gap-1.5"><Send size={14} /> Enviar</span>
          </div>
        </div>
      )}

      {/* TikTok — full-bleed vertical video, the most recognizable layout on the platform:
         side icon stack + bottom-left handle/caption/sound overlay. */}
      {platform === 'TIKTOK' && (
        <div className="relative w-full max-w-[220px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-[#000] shadow-card">
          <div className="absolute top-3 left-0 right-0 flex items-center justify-center gap-4 z-10 text-[11px] font-bold">
            <span className="text-[#fff]/60">Seguindo</span>
            <span className="text-[#fff] border-b-2 border-[#fff] pb-0.5">Para Você</span>
          </div>

          <PreviewMedia image={firstMedia} title={title} hook={hook} fill generating={generating} uploadProgress={uploadProgress} />

          {/* Right icon stack */}
          <div className="absolute right-2 bottom-16 flex flex-col items-center gap-4 z-10 text-[#fff]">
            <Avatar className="h-8 w-8 ring-2 ring-[#fff]">
              {clientLogoUrl && <AvatarImage src={clientLogoUrl} />}
              <AvatarFallback className="bg-primary/40 text-[#fff] text-[10px]">{clientInitial}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-center gap-0.5">
              <Heart size={24} fill="currentColor" />
              <span className="text-[10px] font-bold">0</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <MessageCircle size={22} fill="currentColor" />
              <span className="text-[10px] font-bold">0</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Bookmark size={22} fill="currentColor" />
              <span className="text-[10px] font-bold">0</span>
            </div>
            <Share2 size={22} />
          </div>

          <div className="absolute bottom-0 left-0 right-14 p-3 bg-gradient-to-t from-[#000]/80 via-[#000]/30 to-transparent">
            <p className="text-[11px] font-bold text-[#fff]">@{clientHandle}</p>
            <p className="text-[11px] text-[#fff]/90 leading-snug line-clamp-2 mt-0.5">{caption || title}</p>
            <p className="text-[10px] text-[#fff]/80 flex items-center gap-1 mt-1">
              <Music2 size={10} /> som original
            </p>
          </div>
        </div>
      )}

      {/* YouTube — shown as the watch page itself, not a feed post: letterboxed player (any
         aspect ratio, matching the real YouTube player) + title/channel row below. */}
      {platform === 'YOUTUBE' && (
        <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden shadow-card border border-slate-200 bg-[#fff]">
          <PreviewMedia image={firstMedia} title={title} hook={hook} aspect="aspect-video" generating={generating} uploadProgress={uploadProgress} contain />

          <div className="p-3.5 space-y-2.5">
            <p className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">{title}</p>

            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                {clientLogoUrl && <AvatarImage src={clientLogoUrl} />}
                <AvatarFallback className="bg-[#FF0000]/15 text-[#FF0000] text-xs">{clientInitial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{clientName || 'Canal'}</p>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Eye size={10} /> 0 visualizações • agora
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-medium line-clamp-3">
              {renderCaption(caption)}
            </p>

            <div className="flex items-center gap-3 pt-1 text-slate-500">
              <span className="flex items-center gap-1 text-[11px] font-bold"><ThumbsUp size={13} /> 0</span>
              <span className="flex items-center gap-1 text-[11px] font-bold"><ThumbsDown size={13} /></span>
              <span className="flex items-center gap-1 text-[11px] font-bold ml-auto"><Share2 size={13} /> Compartilhar</span>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
