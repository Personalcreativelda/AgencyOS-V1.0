import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, RefreshCw, Video } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'

type AdPreview = {
  adId: string; iframeUrl: string | null; iframeHeight: number; width: number
  videoUrl: string | null; isVideo: boolean; postUrl: string | null
  text: string | null; title: string | null; callToAction: string | null
}

function OfficialFrame({ url, height, name, fallback }: { url: string; height: number; name: string; fallback: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!loading) return
    // Some Meta resources keep the load event pending even after the ad is visible.
    const timeout = window.setTimeout(() => setLoading(false), 10000)
    return () => window.clearTimeout(timeout)
  }, [loading])
  if (failed) return <div className="space-y-3"><p role="status" className="rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">O preview da Meta não respondeu. Pode consultar a mídia e o texto abaixo, recarregar ou abrir na Meta.</p>{fallback}</div>
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-[#fff]">
      {loading && <div role="status" className="border-b border-border bg-card px-3 py-2 text-xs text-muted-foreground">Carregando preview da Meta…</div>}
      <iframe src={url} title={`Preview oficial de ${name}`} className="block w-full border-0" style={{ height }}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true) }} />
    </div>
  )
}

export function AdPreviewPanel({ accountId, adId, adName, isVideo, poster, fallback }: {
  accountId: string; adId: string; adName: string; isVideo: boolean; poster?: string | null; fallback: ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [tab, setTab] = useState('complete')
  const [videoFailed, setVideoFailed] = useState(false)
  const [frameRevision, setFrameRevision] = useState(0)
  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const available = Math.floor(entry.contentRect.width)
      if (available > 0) setWidth(Math.max(240, Math.min(500, available)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const query = useQuery({
    queryKey: ['meta-ad-preview', accountId, adId, width],
    queryFn: async ({ signal }) => (await api.get<AdPreview>(`/ads/accounts/${encodeURIComponent(accountId)}/ads/${encodeURIComponent(adId)}/preview`, { params: { width }, signal })).data,
    enabled: width !== null,
    staleTime: 2 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const data = query.data
  const video = isVideo || data?.isVideo
  const retry = () => { setVideoFailed(false); setFrameRevision(value => value + 1); void query.refetch() }
  const media = (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="bg-muted/30 p-3">
        {data?.videoUrl && !videoFailed ? <video key={data.videoUrl} aria-label={`Vídeo do anúncio ${adName}`} src={data.videoUrl} poster={poster || undefined} controls playsInline preload="metadata" onError={() => setVideoFailed(true)} className="mx-auto max-h-[60dvh] w-full rounded bg-[#000]" /> : fallback}
      </div>
      {video && (!data?.videoUrl || videoFailed) && <p className="flex items-start gap-2 border-t border-border p-3 text-xs leading-relaxed text-muted-foreground"><Video size={15} className="mt-0.5 shrink-0" />{videoFailed ? 'Não foi possível reproduzir o arquivo. Tente recarregar ou use o preview completo.' : 'A Meta não disponibilizou o arquivo de vídeo para esta conexão. Tente reproduzir no anúncio completo ou abrir na Meta.'}</p>}
      {(data?.text || data?.title) && <div className="space-y-2 border-t border-border p-4">{data.title && <p className="text-sm font-medium">{data.title}</p>}{data.text && <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{data.text}</p>}</div>}
    </div>
  )

  return (
    <div ref={container} className="min-w-0 space-y-3">
      <p className="break-words text-sm font-medium">{adName}</p>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Tipo de pré-visualização" className="gap-0.5 rounded-md p-0.5">
          <TabsTrigger value="complete" className="rounded-sm px-3 py-1.5 text-xs font-medium">Anúncio completo</TabsTrigger>
          <TabsTrigger value="media" className="rounded-sm px-3 py-1.5 text-xs font-medium">{video ? 'Vídeo' : 'Imagem'}</TabsTrigger>
        </TabsList>
        <TabsContent value="complete">
          {!width || query.isLoading ? <Skeleton className="h-96" /> : data?.iframeUrl ? (
            <div className="mx-auto" style={{ maxWidth: width }}><OfficialFrame key={`${data.iframeUrl}-${frameRevision}`} url={data.iframeUrl} height={data.iframeHeight} name={adName} fallback={media} /></div>
          ) : <div className="space-y-3"><p role="status" className="rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">{query.isError ? 'Não foi possível consultar o preview completo. O criativo continua disponível abaixo.' : 'O preview completo não está disponível para este anúncio ou para as permissões desta conexão. O conteúdo disponível aparece abaixo.'}</p>{media}</div>}
        </TabsContent>
        <TabsContent value="media">{media}</TabsContent>
      </Tabs>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <Button variant="ghost" size="sm" onClick={retry} loading={query.isFetching}><RefreshCw size={13} />Recarregar preview</Button>
        {data?.postUrl && <Button asChild variant="outline" size="sm"><a href={data.postUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />Abrir na Meta</a></Button>}
      </div>
      {tab === 'complete' && data?.iframeUrl && <p className="text-xs leading-relaxed text-muted-foreground">Preview oficial da Meta. Se não carregar ou não reproduzir, use a aba {video ? 'Vídeo' : 'Imagem'} ou abra na Meta.</p>}
    </div>
  )
}
