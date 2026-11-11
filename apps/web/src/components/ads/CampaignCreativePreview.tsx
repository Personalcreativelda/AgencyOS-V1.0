import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Image as ImageIcon, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { AdPreviewPanel } from './AdPreviewPanel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'

type Creative = { id: string; name: string; status: string; imageUrl: string | null; thumbnailUrl: string | null; isVideo: boolean }
type PreviewResponse = { campaignId: string; ads: Creative[] }

function CreativeImage({ ad, thumbnail = false }: { ad: Creative; thumbnail?: boolean }) {
  const sources = Array.from(new Set([ad.imageUrl, ad.thumbnailUrl].filter((src): src is string => Boolean(src))))
  const [failedSource, setFailedSource] = useState(0)
  const source = sources[failedSource]
  return source ? (
    <img key={source} src={source} alt={thumbnail ? '' : ad.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedSource(index => index + 1)} className={thumbnail ? 'size-full object-cover' : 'mx-auto max-h-[55dvh] w-full object-contain'} />
  ) : (
    <div className="flex h-full min-h-12 flex-col items-center justify-center gap-2 p-2 text-muted-foreground">
      <ImageIcon size={thumbnail ? 18 : 28} aria-hidden />
      {!thumbnail && <p className="text-center text-xs font-normal">Imagem indisponível na Meta.</p>}
    </div>
  )
}

export function CampaignCreativePreview({ accountId, campaignId, campaignName }: { accountId: string; campaignId: string; campaignName: string }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedAdId, setSelectedAdId] = useState('')
  useEffect(() => {
    const node = trigger.current
    if (!node) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '200px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const query = useQuery({
    queryKey: ['campaign-creatives', accountId, campaignId],
    queryFn: async ({ signal }) => (await api.get<PreviewResponse>(`/ads/accounts/${encodeURIComponent(accountId)}/campaigns/${encodeURIComponent(campaignId)}/creatives`, { signal })).data,
    enabled: Boolean(accountId && campaignId && (visible || open)),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const ads = query.data?.ads || []
  const selectedAd = ads.find(ad => ad.id === selectedAdId) || ads[0]
  const first = ads.find(ad => ad.imageUrl || ad.thumbnailUrl) || ads[0]
  return (
    <>
      <button ref={trigger} type="button" aria-label={`Ver anúncios de ${campaignName}`} title="Ver anúncio completo" onClick={() => setOpen(true)} className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
        {query.isLoading ? <Skeleton className="size-full rounded-none" /> : first ? <CreativeImage key={`${first.id}-${first.imageUrl}-${first.thumbnailUrl}`} ad={first} thumbnail /> : <ImageIcon size={18} aria-hidden />}
        {ads.length > 1 && <span className="absolute bottom-0 right-0 rounded-tl bg-[#000]/75 px-1 text-[11px] leading-4 text-[#fff]">+{ads.length - 1}</span>}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" className="[scrollbar-gutter:stable]">
          <DialogHeader>
            <DialogTitle>Pré-visualização do anúncio</DialogTitle>
            <DialogDescription>Confira o conteúdo publicado e a mídia do anúncio. As métricas da tabela referem-se à campanha.</DialogDescription>
          </DialogHeader>
          {query.isLoading ? <Skeleton className="h-64" /> : query.isError ? (
            <div role="alert" className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">Não foi possível carregar os anúncios. Verifique a conexão da conta com a Meta.</p>
              <Button variant="outline" onClick={() => void query.refetch()} loading={query.isFetching}><RefreshCw size={14} />Tentar novamente</Button>
            </div>
          ) : selectedAd ? <div className="space-y-4">
            {ads.length > 1 && <div>
              <label className="mb-1.5 block text-xs text-muted-foreground" htmlFor={`campaign-ad-${campaignId}`}>Anúncio · {ads.length} nesta campanha</label>
              <Select value={selectedAd.id} onValueChange={setSelectedAdId}>
                <SelectTrigger id={`campaign-ad-${campaignId}`}><SelectValue /></SelectTrigger>
                <SelectContent>{ads.map(ad => <SelectItem key={ad.id} value={ad.id}>{ad.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>}
            <AdPreviewPanel key={selectedAd.id} accountId={accountId} adId={selectedAd.id} adName={selectedAd.name} isVideo={selectedAd.isVideo} poster={selectedAd.imageUrl || selectedAd.thumbnailUrl}
              fallback={<CreativeImage key={`${selectedAd.id}-${selectedAd.imageUrl}-${selectedAd.thumbnailUrl}`} ad={selectedAd} />} />
          </div> : <p className="py-8 text-center text-sm font-normal text-muted-foreground">A Meta não retornou anúncios para esta campanha.</p>}
        </DialogContent>
      </Dialog>
    </>
  )
}
