import { Link } from 'react-router-dom'
import { ArrowUpRight, Eye, FileText, Layers, MoreHorizontal, Play, Trash2 } from 'lucide-react'
import { cn, CONTENT_TYPE_LABELS, PLATFORM_LABELS } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { CreativeThumbnail } from '@/components/content/CreativeMedia'
import { getCreativeMedia, type LibraryContent } from '@/components/content/libraryUtils'
import { PlatformIcon } from './PlatformIcon'

type CreativeItemProps = {
  content: LibraryContent
  onClick: () => void
  onPreview: () => void
  onDelete: () => void
}
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background'

function ContentActions({ content, onClick, onPreview, onDelete }: CreativeItemProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Ações de ${content.title}`} title="Ações do conteúdo" className={cn('relative z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted motion-reduce:transition-none', focus)}><MoreHorizontal size={18} aria-hidden /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={onClick}><ArrowUpRight size={15} aria-hidden />Abrir Workspace</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => requestAnimationFrame(onPreview)}><Eye size={15} aria-hidden />Pré-visualizar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => requestAnimationFrame(onDelete)} className="text-error-dark data-[highlighted]:bg-error/10 data-[highlighted]:text-error-dark dark:text-error-light dark:data-[highlighted]:text-error-light"><Trash2 size={15} aria-hidden />Excluir conteúdo</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Platforms({ content }: { content: LibraryContent }) {
  const platforms = content.platforms || []
  return platforms.length ? <span className="inline-flex shrink-0 items-center gap-1.5" aria-label={`Redes: ${platforms.map(item => PLATFORM_LABELS[item.platform] || item.platform).join(', ')}`}>
    {platforms.slice(0, 4).map(item => <span key={item.id} aria-hidden><PlatformIcon platform={item.platform} size={13} /></span>)}
    {platforms.length > 4 && <span className="text-xs text-muted-foreground" aria-hidden>+{platforms.length - 4}</span>}
  </span> : null
}

function ScheduledDate({ content }: { content: LibraryContent }) {
  const date = content.scheduledAt ? new Date(content.scheduledAt) : null
  return date && Number.isFinite(date.getTime()) ? <time dateTime={content.scheduledAt!} title="Data agendada" className="text-xs leading-5 text-muted-foreground">{date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time> : <span className="text-xs leading-5 text-muted-foreground">Sem data agendada</span>
}

export function ContentGridTile(props: CreativeItemProps) {
  const { content, onPreview } = props
  const media = getCreativeMedia(content)
  const video = media[0]?.mimeType.startsWith('video/') || ['REEL', 'VIDEO', 'STORY'].includes(content.contentType)
  const carousel = content.contentType === 'CAROUSEL'
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors duration-150 hover:border-muted-foreground/50 focus-within:border-primary/60 motion-reduce:transition-none">
      <button type="button" onClick={onPreview} aria-label={`Pré-visualizar ${content.title}`} className={cn('group/media relative block aspect-[4/3] w-full overflow-hidden border-b border-border bg-muted/50 focus-visible:ring-inset', focus)}>
        <CreativeThumbnail content={content} showLabel />
        <span className="absolute left-3 top-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-md border border-border/60 bg-card/95 px-2 py-1 text-xs font-medium text-foreground">
          {carousel ? <Layers size={13} aria-hidden /> : video ? <Play size={12} aria-hidden /> : <FileText size={13} aria-hidden />}
          {CONTENT_TYPE_LABELS[content.contentType] || content.contentType}{carousel && media.length > 0 && <span className="tabular-nums">· {media.length}</span>}
        </span>
        {video && media.length > 0 && <span className="absolute inset-0 flex items-center justify-center"><span className="flex size-11 items-center justify-center rounded-full bg-[#000]/60 text-[#fff] transition-colors group-hover/media:bg-[#000]/75 motion-reduce:transition-none"><Play size={20} aria-hidden className="ml-0.5" /></span></span>}
        <span className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-[#000]/35 to-transparent px-3 pb-3 pt-6 opacity-0 transition-opacity group-hover/media:opacity-100 group-focus-visible/media:opacity-100 motion-reduce:transition-none"><span className="inline-flex items-center gap-1.5 rounded-md bg-card px-2 py-1 text-xs font-medium text-foreground"><Eye size={13} aria-hidden />Pré-visualizar</span></span>
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0"><h3 className="min-h-10 text-sm font-semibold leading-5"><Link to={`/app/content/${content.id}`} title={content.title} className={cn('line-clamp-2 rounded-sm hover:underline hover:underline-offset-4', focus)}>{content.title}</Link></h3>
          <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2"><p className="truncate text-xs leading-5 text-muted-foreground" title={content.client?.name}>{content.client?.name || 'Cliente não disponível'}</p><Platforms content={content} /></div>
          <ScheduledDate content={content} />
        </div>
        <div className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-border pt-2"><StatusBadge status={content.status} className="max-w-[calc(100%-2.75rem)] truncate rounded-md px-2 py-0.5 text-xs font-medium" /><ContentActions {...props} /></div>
      </div>
    </article>
  )
}

export function ContentListRow(props: CreativeItemProps) {
  const { content, onPreview } = props
  const media = getCreativeMedia(content)
  const video = media[0]?.mimeType.startsWith('video/')
  const format = `${CONTENT_TYPE_LABELS[content.contentType] || content.contentType}${content.contentType === 'CAROUSEL' && media.length > 0 ? ` · ${media.length}` : ''}`
  return (
    <article className="group relative flex min-w-0 items-center gap-3 px-3 py-4 transition-colors hover:bg-muted/40 focus-within:bg-muted/40 sm:gap-4 sm:px-5 md:grid md:grid-cols-[minmax(0,1fr)_12rem_9rem_9.5rem_5.5rem] md:gap-5 md:items-center md:px-6 motion-reduce:transition-none">
      <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-4">
        <button type="button" onClick={onPreview} aria-label={`Pré-visualizar ${content.title}`} className={cn('relative z-10 size-14 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted', focus)}>
          <CreativeThumbnail content={content} />
          {(video || (content.contentType === 'CAROUSEL' && media.length > 0)) && <span className="absolute bottom-0 right-0 inline-flex items-center gap-0.5 rounded-tl-md bg-[#000]/70 px-1 py-0.5 text-[10px] text-[#fff]">{video ? <Play size={10} aria-hidden /> : <><Layers size={10} aria-hidden />{media.length}</>}</span>}
        </button>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground"><Link to={`/app/content/${content.id}`} aria-label={`Abrir Workspace de ${content.title}`} className="outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary/60">{content.title}</Link></h3>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
            <span className="max-w-full truncate rounded-md bg-primary/10 px-1.5 py-px font-semibold text-primary-dark dark:text-primary-light">{content.client?.name || 'Cliente não disponível'}</span>
            <span className="md:hidden">{format}</span>
            <span className="md:hidden"><Platforms content={content} /></span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:hidden"><ScheduledDate content={content} /><StatusBadge status={content.status} className="rounded-md px-2 py-0.5 text-xs font-medium sm:hidden" /></div>
        </div>
      </div>
      <div className="hidden min-w-0 space-y-1 md:block">
        <p className="truncate text-[13px] font-medium text-foreground/85">{format}</p>
        <Platforms content={content} />
      </div>
      <div className="hidden text-[13px] md:block"><ScheduledDate content={content} /></div>
      <div className="hidden sm:block"><StatusBadge status={content.status} className="rounded-md px-2 py-0.5 text-xs font-medium" /></div>
      <div className="md:flex md:justify-end"><ContentActions {...props} /></div>
    </article>
  )
}

