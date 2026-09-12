import React, { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Sparkles, Send, Copy, ImagePlus, Upload,
  MessageSquare, Share2, Check, RefreshCw, Mail, MessageCircle, XCircle, Trash2, X, Plus
} from 'lucide-react'
import api from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CONTENT_TYPE_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateTimeField, toDateTimeLocalValue } from '@/components/ui/DateTimeField'
import { PlatformPicker } from '@/components/planner/PlatformPicker'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { SocialPreview, type SocialPlatform } from '@/components/SocialPreview'
import { useThemeStore } from '@/stores/themeStore'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'

type PublishablePlatform = 'FACEBOOK' | 'INSTAGRAM' | 'INSTAGRAM_STORY' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE' | 'WHATSAPP'

export function ContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { mode } = useThemeStore()
  const [content, setContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // AI Generation States
  const [generatingCaption, setGeneratingCaption] = useState(false)
  const [generatingHooks, setGeneratingHooks] = useState(false)
  const [aiHooks, setAiHooks] = useState<string[]>([])
  const [generatingImage, setGeneratingImage] = useState(false)
  const [uploadingCreative, setUploadingCreative] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  // Local blob URLs for the files just picked, shown as spinning placeholders in the thumbnail
  // strip the instant they're selected — before the network round-trip even starts — so the
  // upload feels immediate the way Facebook's composer does, instead of a blank wait.
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [addingMore, setAddingMore] = useState(false)
  // Guards handleRemoveSlide/handleAddMoreImages against overlapping calls — both build their
  // request off `primaryMediaList` captured at click time, so firing a second one before the
  // first's loadContent() resolves works off a stale list and can resend an id that's already
  // been dropped/added, duplicating it in the same PRIMARY batch (confirmed live: this produced
  // real duplicate ContentAsset rows sharing one assetId — the source of the duplicate React key
  // warning and the confusing "error, but the image vanished anyway" behavior).
  const [assetsBusy, setAssetsBusy] = useState(false)
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>('INSTAGRAM')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addMoreInputRef = useRef<HTMLInputElement>(null)

  // Approval Link State — generating the link never sends anything automatically; each channel
  // below is an explicit manual "Enviar" action.
  const [approvalModal, setApprovalModal] = useState(false)
  const [approvalUrl, setApprovalUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [manualPhone, setManualPhone] = useState('')
  const [sendingManualWa, setSendingManualWa] = useState(false)
  const [manualWaResult, setManualWaResult] = useState<{ success: boolean; message: string } | null>(null)
  const [manualEmail, setManualEmail] = useState('')
  const [sendingManualEmail, setSendingManualEmail] = useState(false)
  const [manualEmailResult, setManualEmailResult] = useState<{ success: boolean; message: string } | null>(null)

  // Comments
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')

  // Social publishing
  const [connections, setConnections] = useState<any[]>([])
  const [publishing, setPublishing] = useState<PublishablePlatform | null>(null)
  const [sendingWhatsAppContent, setSendingWhatsAppContent] = useState(false)

  const loadContent = async () => {
    try {
      const { data } = await api.get(`/contents/${id}`)
      setContent(data)
      setComments(data.comments || [])
      if (data.clientId) {
        api.get('/social/connections', { params: { clientId: data.clientId } })
          .then((res) => setConnections(res.data || []))
          .catch(() => setConnections([]))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContent()
  }, [id])

  const PLATFORM_PUBLISH_LABEL: Record<PublishablePlatform, string> = {
    FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', INSTAGRAM_STORY: 'Stories do Instagram',
    LINKEDIN: 'LinkedIn', TIKTOK: 'TikTok', YOUTUBE: 'YouTube', WHATSAPP: 'Status do WhatsApp',
  }

  const handlePublish = async (platform: PublishablePlatform) => {
    const label = PLATFORM_PUBLISH_LABEL[platform]
    const ok = await confirmDialog({
      title: `Publicar no ${label}?`,
      description: 'Isso vai ao ar imediatamente.',
      confirmLabel: 'Publicar',
    })
    if (!ok) return
    setPublishing(platform)
    try {
      const { data } = await api.post('/social/publish', { contentId: content.id, platform })
      if (data.externalPostUrl) {
        const openPost = await confirmDialog({
          title: 'Publicado com sucesso!',
          description: `Abrir o post no ${label} pra conferir?`,
          confirmLabel: 'Abrir',
          cancelLabel: 'Agora não',
        })
        if (openPost) window.open(data.externalPostUrl, '_blank', 'noopener,noreferrer')
      } else {
        toast.success('Publicado com sucesso!')
      }
      await loadContent()
    } catch (err: any) {
      toast.error('Erro ao publicar', getErrorMessage(err))
    } finally {
      setPublishing(null)
    }
  }

  const handleSendWhatsAppContent = async () => {
    const ok = await confirmDialog({
      title: 'Enviar por WhatsApp?',
      description: `Enviar este criativo por WhatsApp para ${content.client?.name}?`,
      confirmLabel: 'Enviar',
    })
    if (!ok) return
    setSendingWhatsAppContent(true)
    try {
      await api.post('/social/whatsapp/send-content', { contentId: content.id })
      toast.success('Enviado com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao enviar por WhatsApp', getErrorMessage(err))
    } finally {
      setSendingWhatsAppContent(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch(`/contents/${id}`, {
        title: content.title,
        brief: content.brief,
        hook: content.hook,
        caption: content.caption,
        cta: content.cta,
        status: content.status,
        scheduledAt: content.scheduledAt,
      })
      toast.success('Conteúdo salvo com sucesso!')
    } catch (err) {
      toast.error('Erro ao salvar conteúdo', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteContent = async () => {
    const ok = await confirmDialog({
      title: 'Excluir conteúdo?',
      description: `"${content.title}" será removido do calendário e da lista de criativos. Essa ação não pode ser desfeita.`,
      variant: 'destructive',
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    try {
      await api.delete(`/contents/${id}`)
      toast.success('Conteúdo excluído.')
      navigate('/app/content')
    } catch (err) {
      toast.error('Erro ao excluir conteúdo', getErrorMessage(err))
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { data } = await api.post(`/contents/${id}/change-status`, { status: newStatus })
      setContent({ ...content, status: data.status })
    } catch (err) {
      toast.error('Erro ao alterar status', getErrorMessage(err))
    }
  }

  // Platform selection used to only exist at content-creation time — once inside the
  // Workspace there was no way to see or change which network(s) a post targets. Reuses the
  // same PlatformPicker from creation; each toggle hits the dedicated platform endpoints
  // immediately (add/remove), matching how they already work (see content.routes.ts), then
  // re-syncs from the server rather than hand-merging optimistic state.
  const handleTogglePlatforms = async (nextPlatforms: string[]) => {
    const current: any[] = content.platforms || []
    const currentValues = current.map((p) => p.platform)
    const toAdd = nextPlatforms.filter((p) => !currentValues.includes(p))
    const toRemove = current.filter((p) => !nextPlatforms.includes(p.platform))
    try {
      await Promise.all([
        ...toAdd.map((platform) => api.post(`/contents/${content.id}/platforms`, { platform })),
        ...toRemove.map((p) => api.delete(`/contents/${content.id}/platforms/${p.id}`)),
      ])
    } catch (err) {
      toast.error('Erro ao atualizar redes sociais', getErrorMessage(err))
    } finally {
      await loadContent()
    }
  }

  const handleGenerateCaption = async () => {
    setGeneratingCaption(true)
    try {
      const { data } = await api.post('/ai/generate-caption', {
        clientId: content.clientId,
        contentId: content.id,
        brief: content.brief || content.title,
        contentType: content.contentType,
      })
      setContent({
        ...content,
        caption: data.caption || content.caption,
        hook: data.hook || content.hook,
        cta: data.cta || content.cta,
      })
    } catch (err) {
      toast.error('Erro ao gerar legenda com IA', getErrorMessage(err))
    } finally {
      setGeneratingCaption(false)
    }
  }

  const handleGenerateHooks = async () => {
    setGeneratingHooks(true)
    try {
      const { data } = await api.post('/ai/generate-hook', {
        clientId: content.clientId,
        brief: content.brief || content.title,
        contentType: content.contentType,
      })
      setAiHooks(data.hooks || [])
    } catch (err) {
      toast.error('Erro ao gerar hooks', getErrorMessage(err))
    } finally {
      setGeneratingHooks(false)
    }
  }

  const handleGenerateImage = async () => {
    setGeneratingImage(true)
    try {
      await api.post('/ai/generate-image', {
        clientId: content.clientId,
        contentId: content.id,
        brief: content.brief || content.title,
        contentType: content.contentType,
        platform: previewPlatform,
      })
      await loadContent()
    } catch (err) {
      toast.error('Erro ao gerar proposta de imagem com IA', getErrorMessage(err))
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleUploadCreative = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const previews = files.map((f) => URL.createObjectURL(f))
    setPendingPreviews(previews)
    setUploadingCreative(true)
    setUploadProgress(0)
    try {
      const formData = new FormData()
      if (files.length > 1) {
        // Carousel — replaces the whole set with these files, in the order selected. Selecting
        // more than one file IS the signal that this is now a carousel, regardless of whatever
        // "Formato" was picked when the content was created — promote it here so the label
        // (Kanban card, lists) stays accurate instead of silently mismatching what's attached.
        files.forEach((file) => formData.append('files', file))
        formData.append('contentId', content.id)
        await api.post('/assets/upload-batch', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (evt) => {
            if (evt.total) setUploadProgress(Math.round((evt.loaded / evt.total) * 100))
          },
        })
        if (content.contentType !== 'CAROUSEL') {
          await api.patch(`/contents/${content.id}`, { contentType: 'CAROUSEL' })
        }
        toast.success(`${files.length} imagens enviadas com sucesso!`)
      } else {
        formData.append('file', files[0])
        formData.append('clientId', content.clientId)
        formData.append('contentId', content.id)
        await api.post('/assets/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (evt) => {
            if (evt.total) setUploadProgress(Math.round((evt.loaded / evt.total) * 100))
          },
        })
        toast.success('Criativo enviado com sucesso!')
      }
      await loadContent()
    } catch (err) {
      toast.error('Erro ao enviar o criativo', getErrorMessage(err))
    } finally {
      setUploadingCreative(false)
      setUploadProgress(null)
      previews.forEach((url) => URL.revokeObjectURL(url))
      setPendingPreviews([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Removes one image from the current carousel set by re-sending the remaining asset ids —
  // does not touch the Asset record itself, just which ones are PRIMARY for this content (see
  // setContentPrimaryAssets on the backend). Dropping to 1 remaining is fine (content just stops
  // being a carousel); dropping to 0 is blocked — the endpoint requires a non-empty set, and
  // removing the last image should go through "Enviar Criativo" instead.
  const handleRemoveSlide = async (assetId: string) => {
    if (assetsBusy) return
    const remaining = primaryMediaList.filter((m: any) => m.id !== assetId).map((m: any) => m.id)
    if (remaining.length === 0) return
    setAssetsBusy(true)
    try {
      await api.put(`/assets/content/${content.id}/set`, { assetIds: remaining })
      await loadContent()
    } catch (err) {
      toast.error('Erro ao remover imagem', getErrorMessage(err))
    } finally {
      setAssetsBusy(false)
    }
  }

  const MAX_CAROUSEL_IMAGES = 10 // mirrors the backend's cap (assets.routes.ts), itself Instagram's carousel limit

  // "+" tile in the thumbnail strip — appends to the existing set instead of replacing it, unlike
  // the "Enviar Imagens" button above. Uploads each file standalone (no contentId, so
  // /assets/upload won't touch this content's set on its own), then combines the existing ids
  // with the new ones in a single call to the set endpoint.
  const handleAddMoreImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (assetsBusy) return
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const room = MAX_CAROUSEL_IMAGES - primaryMediaList.length
    if (room <= 0) {
      toast.error('Limite de imagens atingido', `O carrossel aceita no máximo ${MAX_CAROUSEL_IMAGES} imagens.`)
      if (addMoreInputRef.current) addMoreInputRef.current.value = ''
      return
    }
    const accepted = files.slice(0, room)
    const previews = accepted.map((f) => URL.createObjectURL(f))
    setPendingPreviews(previews)
    setAddingMore(true)
    setAssetsBusy(true)
    try {
      const newIds: string[] = []
      for (const file of accepted) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('clientId', content.clientId)
        const { data } = await api.post('/assets/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        newIds.push(data.id)
      }
      const combined = [...primaryMediaList.map((m: any) => m.id), ...newIds]
      await api.put(`/assets/content/${content.id}/set`, { assetIds: combined })
      if (content.contentType !== 'CAROUSEL' && combined.length > 1) {
        await api.patch(`/contents/${content.id}`, { contentType: 'CAROUSEL' })
      }
      await loadContent()
      toast.success(`${accepted.length} imagem${accepted.length > 1 ? 's' : ''} adicionada${accepted.length > 1 ? 's' : ''}!`)
    } catch (err) {
      toast.error('Erro ao adicionar imagens', getErrorMessage(err))
    } finally {
      setAddingMore(false)
      setAssetsBusy(false)
      previews.forEach((url) => URL.revokeObjectURL(url))
      setPendingPreviews([])
      if (addMoreInputRef.current) addMoreInputRef.current.value = ''
    }
  }

  const handleRequestApproval = async () => {
    try {
      const { data } = await api.post(`/approvals/contents/${id}/request`, {
        expiresInDays: 7,
      })
      setApprovalUrl(data.portalUrl)
      setManualPhone(content.client?.phone || '')
      setManualWaResult(null)
      setManualEmail(content.client?.email || '')
      setManualEmailResult(null)
      setApprovalModal(true)
      setContent({ ...content, status: 'CLIENT_REVIEW' })
    } catch (err) {
      toast.error('Erro ao gerar link de aprovação', getErrorMessage(err))
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    try {
      const { data } = await api.post(`/contents/${id}/comments`, { comment: newComment })
      setComments([...comments, data])
      setNewComment('')
    } catch (err) {
      toast.error('Erro ao adicionar comentário', getErrorMessage(err))
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(approvalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendManualWhatsapp = async () => {
    if (!manualPhone.trim()) return
    setSendingManualWa(true)
    setManualWaResult(null)
    try {
      await api.post(`/approvals/contents/${id}/send-whatsapp`, { phone: manualPhone.trim(), portalUrl: approvalUrl })
      setManualWaResult({ success: true, message: 'Enviado com sucesso!' })
    } catch (err: any) {
      setManualWaResult({ success: false, message: err.response?.data?.error || 'Erro ao enviar. Verifique se o WhatsApp da agência está conectado em Redes Sociais.' })
    } finally {
      setSendingManualWa(false)
    }
  }

  const handleSendManualEmail = async () => {
    if (!manualEmail.trim()) return
    setSendingManualEmail(true)
    setManualEmailResult(null)
    try {
      await api.post(`/approvals/contents/${id}/send-email`, { email: manualEmail.trim(), clientName: content.client?.name, portalUrl: approvalUrl })
      setManualEmailResult({ success: true, message: 'Enviado com sucesso!' })
    } catch (err: any) {
      setManualEmailResult({ success: false, message: err.response?.data?.error || 'Erro ao enviar. Verifique se o SMTP está configurado em Configurações.' })
    } finally {
      setSendingManualEmail(false)
    }
  }

  if (loading || !content) {
    return (
      <div className="p-4 sm:p-8 space-y-6">
        <Skeleton className="h-8 w-1/4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    )
  }

  // The content's current active set (role: 'PRIMARY', set by setContentPrimaryAssets on the
  // backend), in carousel order — NOT filtered to images only, since video is required for
  // TikTok/YouTube and common for Reels; the preview branches on mimeType to render <video> vs
  // <img>. For CAROUSEL content this can be 2+ images; for everything else it's always 0 or 1.
  const primaryMediaList = (content.assets || [])
    .filter((a: any) => a.role === 'PRIMARY')
    .slice()
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((a: any) => a.asset)
  const primaryMedia = primaryMediaList[0] || null

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app/content">
              <ArrowLeft size={20} />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary">{content.client?.name}</span>
              <span className="text-xs text-muted-foreground/60">•</span>
              <span className="text-xs text-muted-foreground font-medium">{CONTENT_TYPE_LABELS[content.contentType]}</span>
            </div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">{content.title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={content.status} />

          <div className="w-48">
            <Select value={content.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Rascunho</SelectItem>
                <SelectItem value="IN_PRODUCTION">Em Produção</SelectItem>
                <SelectItem value="INTERNAL_REVIEW">Revisão Interna</SelectItem>
                <SelectItem value="CLIENT_REVIEW">Aguardando Cliente</SelectItem>
                <SelectItem value="APPROVED">Aprovado</SelectItem>
                <SelectItem value="SCHEDULED">Agendado</SelectItem>
                <SelectItem value="PUBLISHED">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" onClick={handleRequestApproval} className="bg-warning hover:bg-warning-dark text-warning-foreground hover:text-warning-foreground">
            <Share2 size={14} />
            <span>Link de Aprovação</span>
          </Button>

          {/* Shares the creative with the client's own phone via the agency's connected
             number — for their records/approval, unrelated to publishing to any network
             (that's the "Publicar" button inside each preview tab, including WhatsApp Status). */}
          <Button variant="outline" onClick={handleSendWhatsAppContent} loading={sendingWhatsAppContent} className="gap-1.5">
            {!sendingWhatsAppContent && (
              <>
                <MessageCircle size={14} />
                <span>Enviar por WhatsApp</span>
              </>
            )}
          </Button>

          <Button onClick={handleSave} loading={saving}>
            {!saving && <span>Salvar Alterações</span>}
            {saving && <span>Salvando...</span>}
          </Button>

          <Button variant="ghost" size="icon" title="Excluir conteúdo" onClick={handleDeleteContent} className="hover:text-error hover:bg-error/10">
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Social Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Preview Social
              </span>
              <Badge variant="primary">Simulação Realtime</Badge>
            </div>

            <SocialPreview
              clientName={content.client?.name}
              clientLogoUrl={content.client?.logoUrl}
              title={content.title}
              hook={content.hook}
              caption={content.caption}
              cta={content.cta}
              image={primaryMedia}
              mediaList={primaryMediaList}
              generating={generatingImage}
              uploadProgress={uploadProgress}
              selectedPlatforms={(content.platforms || []).map((p: any) => p.platform)}
              value={previewPlatform}
              onChange={setPreviewPlatform}
              dark={mode === 'dark'}
            />

            {/* Image controls */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleGenerateImage} disabled={generatingImage} className="gap-1.5">
                <ImagePlus size={13} />
                <span>{generatingImage ? 'Gerando imagem...' : 'Gerar com IA'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                loading={uploadingCreative}
                className="gap-1.5"
              >
                {!uploadingCreative && <Upload size={13} />}
                <span>{uploadingCreative ? `Enviando... ${uploadProgress ?? 0}%` : content.contentType === 'CAROUSEL' ? 'Enviar Imagens' : 'Enviar Criativo'}</span>
              </Button>
              {/* Always allows picking multiple files — selecting more than one is what makes
                 this a carousel (see handleUploadCreative), not a separate format toggle the
                 user has to remember to set first. Single selection still works exactly as
                 before, video included. */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={handleUploadCreative}
              />

              {(previewPlatform === 'FACEBOOK' || previewPlatform === 'INSTAGRAM' || previewPlatform === 'STORY') && (() => {
                const targetPlatform = previewPlatform === 'STORY' ? 'INSTAGRAM_STORY' : previewPlatform
                const connectionPlatform = previewPlatform === 'STORY' ? 'INSTAGRAM' : previewPlatform
                return connections.some((c) => c.platform === connectionPlatform && c.status === 'ACTIVE') ? (
                  <Button
                    size="sm"
                    onClick={() => handlePublish(targetPlatform)}
                    loading={publishing === targetPlatform}
                    className="gap-1.5 ml-auto"
                  >
                    {publishing === targetPlatform ? (
                      <span>Publicando...</span>
                    ) : (
                      <>
                        <Send size={13} />
                        <span>Publicar {previewPlatform === 'STORY' ? 'Story no Instagram' : `no ${connectionPlatform === 'FACEBOOK' ? 'Facebook' : 'Instagram'}`}</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground font-medium ml-auto">
                    Conecte o {connectionPlatform === 'FACEBOOK' ? 'Facebook' : 'Instagram'} em Configurações para publicar direto
                  </span>
                )
              })()}

              {(previewPlatform === 'LINKEDIN' || previewPlatform === 'TIKTOK' || previewPlatform === 'YOUTUBE' || previewPlatform === 'WHATSAPP') && (() => {
                const targetPlatform = previewPlatform as PublishablePlatform
                const label = PLATFORM_PUBLISH_LABEL[targetPlatform]
                return connections.some((c) => c.platform === targetPlatform && c.status === 'ACTIVE') ? (
                  <Button
                    size="sm"
                    onClick={() => handlePublish(targetPlatform)}
                    loading={publishing === targetPlatform}
                    className="gap-1.5 ml-auto"
                  >
                    {publishing === targetPlatform ? (
                      <span>
                        {targetPlatform === 'WHATSAPP'
                          ? primaryMediaList.length > 1
                            ? `Publicando ${primaryMediaList.length} imagens... pode levar vários minutos`
                            : 'Publicando... pode levar até 1 minuto'
                          : 'Publicando...'}
                      </span>
                    ) : (
                      <>
                        <Send size={13} />
                        <span>Publicar no {label}</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground font-medium ml-auto">
                    Conecte o {label} em Configurações para publicar direto
                  </span>
                )
              })()}
            </div>

            {/* Thumbnail strip for the current set. Images only — video content (REEL/VIDEO/
               STORY) never shows this, since carousels are image-only (see the plan). No
               drag-to-reorder in v1: remove individual slides with the × below, or replace the
               whole set via "Enviar Imagens" to reorder from scratch. */}
            {(() => {
              const isImageOnlySet = primaryMediaList.every((m: any) => !m.mimeType?.startsWith('video/'))
              const showStrip = pendingPreviews.length > 0 || (isImageOnlySet && primaryMediaList.length >= 1)
              if (!showStrip) return null
              return (
                <div className="flex items-center gap-2 pt-3 border-t border-border overflow-x-auto">
                  {uploadingCreative ? (
                    // Replacing the whole set — show only the incoming files as placeholders,
                    // since whatever's currently attached is about to be superseded.
                    pendingPreviews.map((url, i) => (
                      <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
                        <img src={url} alt={`Novo ${i + 1}`} className="w-full h-full object-cover opacity-40" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                        <span className="absolute bottom-0.5 right-0.5 bg-[#000]/60 text-[#fff] text-[9px] font-bold px-1 rounded">{i + 1}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      {primaryMediaList.map((m: any, i: number) => (
                        <div key={m.id ?? i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0 group">
                          <img src={m.publicUrl} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0.5 right-0.5 bg-[#000]/60 text-[#fff] text-[9px] font-bold px-1 rounded">{i + 1}</span>
                          <button
                            type="button"
                            title="Remover imagem"
                            disabled={assetsBusy}
                            onClick={() => handleRemoveSlide(m.id)}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#000]/70 text-[#fff] flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity hover:bg-error disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {addingMore && pendingPreviews.map((url, i) => (
                        <div key={`pending-${i}`} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
                          <img src={url} alt="" className="w-full h-full object-cover opacity-40" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        </div>
                      ))}
                      {!addingMore && primaryMediaList.length < MAX_CAROUSEL_IMAGES && (
                        <button
                          type="button"
                          title="Adicionar imagens"
                          disabled={assetsBusy}
                          onClick={() => addMoreInputRef.current?.click()}
                          className="w-14 h-14 rounded-lg border-2 border-dashed border-border shrink-0 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <Plus size={18} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })()}
            <input
              ref={addMoreInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleAddMoreImages}
            />
          </Card>

          {/* Comments and History */}
          <Card className="space-y-4">
            <div className="flex items-center gap-2 font-bold text-xs text-muted-foreground uppercase tracking-wider">
              <MessageSquare size={16} className="text-primary" />
              <span>Comentários Internos</span>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum comentário registrado.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="p-3 bg-muted rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-foreground">{c.user?.name || 'Equipe'}</span>
                      <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-foreground/80 font-medium">{c.comment}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <Input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escreva uma observação..."
                className="flex-1 px-3 py-2"
              />
              <Button type="submit" size="icon">
                <Send size={14} />
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Copy & AI Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* AI Tools Bar */}
          <Card className="p-4 flex flex-wrap items-center justify-between gap-3 bg-primary/5 border-primary/15">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <span className="text-xs font-bold text-foreground">AI Copywriter (Brand-Aware)</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleGenerateCaption} loading={generatingCaption} className="gap-1.5">
                {!generatingCaption && (
                  <>
                    <RefreshCw size={13} />
                    <span>Gerar Legenda com IA</span>
                  </>
                )}
                {generatingCaption && <span>Escrevendo...</span>}
              </Button>

              <Button variant="outline" onClick={handleGenerateHooks} disabled={generatingHooks}>
                {generatingHooks ? 'Gerando...' : 'Sugerir Hooks'}
              </Button>
            </div>
          </Card>

          {/* AI Hooks */}
          {aiHooks.length > 0 && (
            <Card className="p-4 space-y-2 animate-fade-in border-primary/30">
              <span className="text-xs font-bold text-primary block">Selecione um Hook Sugerido:</span>
              <div className="space-y-1.5">
                {aiHooks.map((h, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    onClick={() => setContent({ ...content, hook: h })}
                    className="w-full justify-start text-left h-auto p-3 whitespace-normal break-words bg-muted hover:bg-primary/10 text-foreground hover:text-primary border border-border"
                  >
                    "{h}"
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {/* Form Fields */}
          <Card className="space-y-5">
            <div>
              <Label htmlFor="contentTitle">Título do Post</Label>
              <Input
                id="contentTitle"
                type="text"
                value={content.title}
                onChange={(e) => setContent({ ...content, title: e.target.value })}
                className="font-bold"
              />
            </div>

            <div>
              <Label htmlFor="contentHook">Hook / Gancho Inicial (Primeira Linha)</Label>
              <Input
                id="contentHook"
                type="text"
                placeholder="Ex: O maior erro que você comete ao escolher um vestido..."
                value={content.hook || ''}
                onChange={(e) => setContent({ ...content, hook: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="contentCaption">Legenda Principal (Copy)</Label>
              <Textarea
                id="contentCaption"
                rows={8}
                placeholder="Escreva a legenda completa ou gere com a IA..."
                value={content.caption || ''}
                onChange={(e) => setContent({ ...content, caption: e.target.value })}
                className="py-3 leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contentCta">Call to Action (CTA)</Label>
                <Input
                  id="contentCta"
                  type="text"
                  placeholder="Ex: Comente EU QUERO / Link na bio"
                  value={content.cta || ''}
                  onChange={(e) => setContent({ ...content, cta: e.target.value })}
                  className="py-2"
                />
              </div>

              <div>
                <Label htmlFor="contentScheduledAt">Data e Hora Agendada</Label>
                <DateTimeField
                  id="contentScheduledAt"
                  value={content.scheduledAt ? toDateTimeLocalValue(content.scheduledAt) : ''}
                  onChange={(v) => setContent({ ...content, scheduledAt: v ? new Date(v).toISOString() : null })}
                />
              </div>
            </div>

            <div>
              <Label>Redes Sociais</Label>
              <PlatformPicker
                value={(content.platforms || []).map((p: any) => p.platform)}
                onChange={handleTogglePlatforms}
              />
            </div>

            <div>
              <Label htmlFor="contentBrief">Briefing & Orientações Visuais</Label>
              <Textarea
                id="contentBrief"
                rows={3}
                placeholder="Direção criativa para o designer..."
                value={content.brief || ''}
                onChange={(e) => setContent({ ...content, brief: e.target.value })}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Client Approval Modal */}
      <Dialog open={approvalModal} onOpenChange={setApprovalModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-warning/15 text-warning-dark flex items-center justify-center shrink-0">
                <Share2 size={22} />
              </div>
              <div>
                <DialogTitle>Link de Aprovação Gerado</DialogTitle>
                <DialogDescription>Envie este link direto para o cliente aprovar sem login</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-3 bg-muted border border-border rounded-xl flex items-center justify-between gap-2">
            <input
              type="text"
              readOnly
              value={approvalUrl}
              className="bg-transparent text-xs font-mono text-foreground/80 w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md truncate"
            />
            <Button variant="solid" size="sm" onClick={copyToClipboard} className="shrink-0 gap-1">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </Button>
          </div>

          <div className="space-y-3 pt-1 border-t border-border">
            <p className="text-[11px] text-muted-foreground font-medium pt-2">
              O link não é enviado automaticamente — escolha o canal e clique em Enviar.
            </p>

            <div className="space-y-2">
              <Label htmlFor="manualEmail" className="flex items-center gap-1.5">
                <Mail size={13} className="text-info" />
                Enviar por Email
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="manualEmail"
                  type="email"
                  placeholder="cliente@marca.com.br"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleSendManualEmail} loading={sendingManualEmail} disabled={!manualEmail.trim()} className="shrink-0">
                  {!sendingManualEmail && <span>Enviar</span>}
                </Button>
              </div>
              {manualEmailResult && (
                <p className={`text-xs font-semibold ${manualEmailResult.success ? 'text-success-dark' : 'text-error'}`}>{manualEmailResult.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="manualWaPhone" className="flex items-center gap-1.5">
                <MessageCircle size={13} className="text-[#25D366]" />
                Enviar por WhatsApp
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="manualWaPhone"
                  type="text"
                  placeholder="+55 11 99999-0000"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleSendManualWhatsapp} loading={sendingManualWa} disabled={!manualPhone.trim()} className="shrink-0">
                  {!sendingManualWa && <span>Enviar</span>}
                </Button>
              </div>
              {manualWaResult && (
                <p className={`text-xs font-semibold ${manualWaResult.success ? 'text-success-dark' : 'text-error'}`}>{manualWaResult.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setApprovalModal(false)}>
              Fechar
            </Button>
            <Button variant="subtle" asChild>
              <a href={approvalUrl} target="_blank" rel="noreferrer">
                Abrir Portal como Cliente
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
