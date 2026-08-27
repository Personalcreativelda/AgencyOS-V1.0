import { Image as ImageIcon, Layers, Video, Clapperboard, FileText } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { getPrimaryImage, getSlideCount } from './plannerUtils'
import { PlatformIcon } from './PlatformIcon'

const TYPE_ICON: Record<string, typeof ImageIcon> = {
  IMAGE: ImageIcon,
  CAROUSEL: Layers,
  REEL: Clapperboard,
  VIDEO: Video,
  STORY: Clapperboard,
  TEXT: FileText,
  ARTICLE: FileText,
}

interface ContentGridTileProps {
  content: any
  onClick: () => void
}

export function ContentGridTile({ content, onClick }: ContentGridTileProps) {
  const image = getPrimaryImage(content)
  const TypeIcon = TYPE_ICON[content.contentType] || FileText
  const time = content.scheduledAt
    ? new Date(content.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : null
  const platforms: string[] = (content.platforms || []).map((p: any) => p.platform)

  return (
    <div
      onClick={onClick}
      title={content.title}
      className="group relative aspect-square rounded-2xl overflow-hidden bg-card border border-border hover:shadow-z8 hover:border-primary/30 transition-all cursor-pointer"
    >
      {image ? (
        <img src={image.publicUrl} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-primary/10">
          <TypeIcon size={28} className="text-primary-dark" strokeWidth={1.5} />
        </div>
      )}

      {/* Type indicator, top-left */}
      {(content.contentType === 'REEL' || content.contentType === 'VIDEO') && (
        <span className="absolute top-2 left-2 bg-[#000]/60 backdrop-blur-sm rounded-full p-1.5">
          <Video size={12} className="text-[#fff]" />
        </span>
      )}
      {content.contentType === 'CAROUSEL' && getSlideCount(content) > 1 && (
        <span className="absolute top-2 left-2 bg-[#000]/60 backdrop-blur-sm text-[#fff] text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
          <Layers size={10} /> {getSlideCount(content)}
        </span>
      )}
      {content.contentType === 'STORY' && (
        <span className="absolute top-2 left-2 bg-[#000]/60 backdrop-blur-sm text-[#fff] text-[10px] font-bold px-2 py-0.5 rounded-full">
          Story
        </span>
      )}

      {/* Status, top-right */}
      <div className="absolute top-2 right-2">
        <StatusBadge status={content.status} className="text-[9px] px-1.5 py-0.5 shadow-z4" />
      </div>

      {/* Caption overlay, bottom — fixed dark scrim regardless of app theme (photo caption, not chrome) */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-[#000]/85 via-[#000]/40 to-transparent">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#fff]/80 mb-0.5">
          <span className="truncate">{content.client?.name}</span>
          {time && <span className="shrink-0">· {time}</span>}
          {platforms.length > 0 && (
            <span className="flex items-center gap-1 ml-auto shrink-0">
              {platforms.slice(0, 2).map((p) => <PlatformIcon key={p} platform={p} size={10} />)}
            </span>
          )}
        </div>
        <p className="text-xs font-bold text-[#fff] leading-snug line-clamp-2">{content.title}</p>
      </div>
    </div>
  )
}
