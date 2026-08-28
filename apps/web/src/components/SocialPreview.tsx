import { useState } from 'react'
import {
  Sparkles, Globe, ThumbsUp, MessageCircle, Share2, Heart, Send, Bookmark, MoreHorizontal,
  Phone, Video, CheckCheck, ChevronLeft, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar'

export type SocialPlatform = 'INSTAGRAM' | 'FACEBOOK' | 'STORY' | 'WHATSAPP'

interface SocialPreviewProps {
  clientName?: string | null
  clientLogoUrl?: string | null
  title: string
  hook?: string | null
  caption?: string | null
  cta?: string | null
  image?: { publicUrl: string } | null
  /** true while the AI is generating/regenerating the creative image — shows a loading
   *  animation over the preview so it's obvious the process is still running (instead of
   *  the person navigating away thinking it silently finished or failed). */
  generating?: boolean
  defaultPlatform?: SocialPlatform
  /** Controlled mode — pass both to let the parent know/drive which tab is active
   *  (e.g. the workspace uses this to show a matching "Publicar no X" button). */
  value?: SocialPlatform
  onChange?: (platform: SocialPlatform) => void
  /** true when embedded on a fixed-dark page (e.g. the public approval portal) so the tab
   *  switcher's own chrome matches — the phone mockups below are always fixed-appearance. */
  dark?: boolean
}

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'STORY', label: 'Stories' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
]

// Fixed slate tones (not our theme-reactive `grey`) — this simulates a real phone screenshot,
// so it must look the same regardless of whether the surrounding app is in light or dark mode.
function GeneratingOverlay({ overImage }: { overImage: boolean }) {
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
      <p className="text-xs font-extrabold text-[#fff]">Gerando criativo com IA...</p>
      <p className="text-[10px] text-slate-300 font-medium">Isso pode levar até 1 minuto — não feche esta página.</p>
    </div>
  )
}

function PreviewMedia({
  image, title, hook, aspect, fill, generating,
}: { image: { publicUrl: string } | null; title: string; hook?: string | null; aspect?: string; fill?: boolean; generating?: boolean }) {
  const wrapperClass = fill ? 'absolute inset-0' : `relative w-full ${aspect || ''}`

  if (image) {
    return (
      <div className={`${wrapperClass} overflow-hidden`}>
        <img src={image.publicUrl} alt={title} className="w-full h-full object-cover" />
        {!fill && <Badge variant="primary" className="absolute top-2.5 left-2.5">Criativo</Badge>}
        {generating && <GeneratingOverlay overImage />}
      </div>
    )
  }

  return (
    <div className={`${wrapperClass} bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-center text-[#fff]`}>
      {generating ? (
        <GeneratingOverlay overImage={false} />
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
  clientName, clientLogoUrl, title, hook, caption, cta, image = null, generating = false,
  defaultPlatform = 'INSTAGRAM', value, onChange, dark = false,
}: SocialPreviewProps) {
  const [internalPlatform, setInternalPlatform] = useState<SocialPlatform>(defaultPlatform)
  const platform = value ?? internalPlatform
  const setPlatform = onChange ?? setInternalPlatform
  const clientHandle = clientName?.toLowerCase().replace(/\s+/g, '') || 'cliente'
  const clientInitial = clientName?.[0] || 'C'

  return (
    <div className="space-y-4 font-sans">
      {/* Note: Tailwind's `white`/`black` keywords are remapped to our reactive grey scale
         (see tailwind.config.ts), so anywhere a *literal*, theme-independent white/black is
         needed (here, and in the fixed phone mockups below) we use `#fff`/`#000` directly. */}
      <div className={cn('flex items-center gap-1 rounded-xl p-1 overflow-x-auto', dark ? 'bg-[#fff]/10' : 'bg-grey-100')}>
        {PLATFORMS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPlatform(p.value)}
            className={cn(
              'flex-1 rounded-lg px-2 py-2 text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all',
              platform === p.value
                ? dark ? 'bg-[#fff]/15 text-[#fff]' : 'bg-[#fff] text-grey-800 shadow-z1'
                : dark ? 'text-grey-400 hover:text-[#fff]' : 'text-grey-500 hover:text-grey-700'
            )}
          >
            {p.label}
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

          <PreviewMedia image={image} title={title} hook={hook} aspect="aspect-square" generating={generating} />

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

          <PreviewMedia image={image} title={title} hook={hook} aspect="aspect-square" generating={generating} />

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

      {/* Stories / Reels / WhatsApp Status */}
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

          <PreviewMedia image={image} title={title} hook={hook} fill generating={generating} />

          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#000]/70 via-[#000]/20 to-transparent">
            {hook && <p className="text-[11px] text-[#fff]/90 italic mb-1 line-clamp-2">"{hook}"</p>}
            {cta && <p className="text-xs font-extrabold text-[#fff]">{cta}</p>}
          </div>
        </div>
      )}

      {/* WhatsApp Chat */}
      {platform === 'WHATSAPP' && (
        <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden shadow-card border border-slate-200">
          <div className="flex items-center gap-2.5 px-3.5 py-3 bg-[#075E54]">
            <ChevronLeft size={18} className="text-[#fff]/80 shrink-0" />
            <Avatar className="h-8 w-8 shrink-0">
              {clientLogoUrl && <AvatarImage src={clientLogoUrl} />}
              <AvatarFallback className="bg-[#fff]/15 text-[#fff] text-xs">{clientInitial}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#fff] leading-none truncate">{clientName || 'Cliente'}</p>
              <p className="text-[10px] text-[#fff]/70 mt-1">online</p>
            </div>
            <Video size={16} className="text-[#fff]/85 shrink-0" />
            <Phone size={14} className="text-[#fff]/85 shrink-0" />
          </div>

          <div
            className="p-3.5 flex flex-col justify-end min-h-[280px]"
            style={{ backgroundColor: '#E5DDD5' }}
          >
            <div className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm overflow-hidden shadow-z1" style={{ backgroundColor: '#DCF8C6' }}>
              <PreviewMedia image={image} title={title} hook={hook} aspect="aspect-square" generating={generating} />
              <div className="px-2.5 pt-1.5 pb-1 space-y-1">
                <p className="text-[13px] text-slate-800 leading-snug whitespace-pre-line font-medium">
                  {caption || title}
                </p>
                {cta && <p className="text-[13px] font-bold text-slate-800">{cta}</p>}
                <div className="flex items-center justify-end gap-1 pt-0.5">
                  <span className="text-[10px] text-slate-500">agora</span>
                  <CheckCheck size={13} className="text-[#53BDEB]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
