import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ExternalLink, FileImage, Film } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { getCreativeMedia, type CreativeAsset, type LibraryContent } from './libraryUtils'

export function CreativeThumbnail({ content, className, showLabel = false, cover = false }: { content: LibraryContent; className?: string; showLabel?: boolean; /** Fill the frame (grid tiles already use the network's aspect ratio). */ cover?: boolean }) {
  const media = getCreativeMedia(content)[0]
  const root = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const video = media?.mimeType.startsWith('video/')
  useEffect(() => {
    setReady(false); setFailed(false)
  }, [media?.publicUrl])
  useEffect(() => {
    if (!video || !root.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '150px' })
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [video])
  const Icon = video || ['REEL', 'VIDEO', 'STORY'].includes(content.contentType) ? Film : FileImage
  return (
    <div ref={root} className={cn('relative flex size-full items-center justify-center overflow-hidden bg-muted/60', className)}>
      {(!media || failed || (video && !ready)) && <div className="flex flex-col items-center gap-2 text-muted-foreground"><Icon size={showLabel ? 36 : 24} strokeWidth={1.5} aria-hidden />{showLabel && (!media || failed) && <span className="text-xs">{failed ? 'Prévia indisponível' : 'Sem mídia associada'}</span>}</div>}
      {media && !failed && (video ? visible && <video key={media.publicUrl} src={`${media.publicUrl}${media.publicUrl.includes('#') ? '' : '#t=0.1'}`} muted playsInline preload="metadata" tabIndex={-1} aria-hidden onLoadedData={() => setReady(true)} onError={() => setFailed(true)} className={cn('absolute inset-0 size-full', cover ? 'object-cover' : 'object-contain', !ready && 'opacity-0')} />
        : <img key={media.publicUrl} src={media.publicUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className={cn('absolute inset-0 size-full', cover ? 'object-cover' : 'object-contain')} />)}
    </div>
  )
}

function PreviewAsset({ media, title }: { media: CreativeAsset; title: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <p role="status" className="px-5 py-14 text-center text-sm leading-6 text-muted-foreground">Não foi possível carregar esta mídia. Abra o Workspace para verificar o ficheiro.</p>
  return media.mimeType.startsWith('video/') ? (
    <video src={media.publicUrl} controls playsInline preload="metadata" aria-label={`Vídeo de ${title}`} onError={() => setFailed(true)} className="mx-auto max-h-[55dvh] w-full bg-[#000] object-contain" />
  ) : <img src={media.publicUrl} alt={title} onError={() => setFailed(true)} className="mx-auto max-h-[55dvh] w-full object-contain" />
}

export function CreativePreview({ content, onClose }: { content: LibraryContent | null; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const media = content ? getCreativeMedia(content) : []
  useEffect(() => { setIndex(0) }, [content?.id])
  const current = media[index]
  const change = (direction: number) => setIndex(value => (value + direction + media.length) % media.length)
  return (
    <Dialog open={Boolean(content)} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent size="lg" className="[scrollbar-gutter:stable]" onKeyDown={event => {
        if (media.length < 2 || (event.target as HTMLElement).closest('video, input, textarea')) return
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); change(event.key === 'ArrowLeft' ? -1 : 1) }
      }}>
        <DialogHeader>
          <DialogTitle className="break-words">{content?.title}</DialogTitle>
          <DialogDescription>{content?.client?.name || 'Cliente não disponível'}</DialogDescription>
        </DialogHeader>
        {content && <>
          <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge status={content.status} /><span role="status" aria-atomic="true" className="text-xs tabular-nums text-muted-foreground">{media.length > 0 ? `Mídia ${index + 1} de ${media.length}` : 'Sem mídia associada'}</span></div>
          <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
            {current ? <PreviewAsset key={`${current.id}-${index}`} media={current} title={content.title} /> : <div className="px-5 py-12 text-center"><FileImage size={28} aria-hidden className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Adicione a mídia deste conteúdo no Workspace.</p></div>}
          </div>
          {media.length > 1 && <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="icon" aria-label="Mídia anterior" onClick={() => change(-1)}><ChevronLeft size={17} aria-hidden /></Button>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto p-1">{media.map((item, position) => <button key={`${item.id}-${position}`} type="button" aria-label={`Ver mídia ${position + 1} de ${media.length}`} aria-pressed={position === index} onClick={() => setIndex(position)} className={cn('flex size-11 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none', position === index ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-muted-foreground')}>
              {item.mimeType.startsWith('image/') ? <img src={item.publicUrl} alt="" loading="lazy" className="size-full object-contain" /> : <Film size={17} aria-hidden className="text-muted-foreground" />}
            </button>)}</div>
            <Button variant="outline" size="icon" aria-label="Próxima mídia" onClick={() => change(1)}><ChevronRight size={17} aria-hidden /></Button>
          </div>}
          {content.caption?.trim() && <details className="rounded-lg border border-border px-3 py-2"><summary className="cursor-pointer rounded py-1 text-xs font-medium">Ver legenda</summary><p className="whitespace-pre-wrap break-words pb-2 pt-3 text-sm leading-relaxed text-muted-foreground">{content.caption}</p></details>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button variant="outline" onClick={onClose}>Fechar</Button><Button asChild><Link to={`/app/content/${content.id}`}><ExternalLink size={14} aria-hidden />Abrir Workspace</Link></Button></div>
        </>}
      </DialogContent>
    </Dialog>
  )
}
