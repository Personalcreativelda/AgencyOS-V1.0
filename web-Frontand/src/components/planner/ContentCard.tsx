import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Image as ImageIcon, Layers, Video, Clapperboard, FileText, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { getPrimaryImage, getSlideCount, getTemporalState, TEMPORAL_ACCENT } from './plannerUtils'
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

interface ContentCardProps {
  content: any
  onClick: () => void
  className?: string
}

export function ContentCard({ content, onClick, className }: ContentCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: content.id,
    data: { content },
  })

  const image = getPrimaryImage(content)
  const TypeIcon = TYPE_ICON[content.contentType] || FileText
  const temporal = getTemporalState(content)
  const time = content.scheduledAt
    ? new Date(content.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null
  const platforms: string[] = (content.platforms || []).map((p: any) => p.platform)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={cn(
        'group flex items-start gap-2 p-2 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-z4 cursor-pointer transition-all overflow-hidden',
        TEMPORAL_ACCENT[temporal],
        isDragging && 'opacity-40 z-50',
        className
      )}
      title={content.title}
    >
      <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
        {image ? (
          <img src={image.publicUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <TypeIcon size={15} className="text-primary-dark" />
        )}
        {(content.contentType === 'REEL' || content.contentType === 'VIDEO') && (
          <span className="absolute bottom-0 right-0 bg-[#000]/60 rounded-tl-md p-0.5">
            <Video size={9} className="text-[#fff]" />
          </span>
        )}
        {content.contentType === 'CAROUSEL' && getSlideCount(content) > 1 && (
          <span className="absolute top-0 right-0 bg-[#000]/60 text-[#fff] text-[8px] font-bold px-1 rounded-bl-md">
            {getSlideCount(content)}
          </span>
        )}
        {content.contentType === 'STORY' && (
          <span className="absolute inset-x-0 bottom-0 bg-[#000]/60 text-[#fff] text-[7px] font-bold text-center leading-tight py-0.5">
            STORY
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
          {time && <span>{time}</span>}
          {platforms.length > 0 && (
            <span className="flex items-center gap-1">
              {time && <span>·</span>}
              {platforms.slice(0, 3).map((p) => <PlatformIcon key={p} platform={p} size={11} />)}
            </span>
          )}
          {temporal === 'failed' && <AlertTriangle size={11} className="text-error ml-auto shrink-0" />}
        </div>
        <p className="text-xs font-bold text-foreground leading-snug line-clamp-2">{content.title}</p>
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          <span className="text-[10px] text-primary font-semibold truncate">{content.client?.name}</span>
          <StatusBadge status={content.status} className="text-[9px] px-1.5 py-0 shrink-0" />
        </div>
      </div>
    </div>
  )
}
