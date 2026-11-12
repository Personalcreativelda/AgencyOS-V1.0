import React, { useEffect, useRef, useState } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Sparkles, Send, Copy, ImagePlus, Upload,
  Share2, Check, Mail, MessageCircle, XCircle, Trash2, X, Plus,
  Save, MoreHorizontal, Eye, Maximize2, AlignLeft, CalendarDays,
  Loader2,
} from 'lucide-react'
import api from '@/lib/api'
import { cn, CONTENT_TYPE_LABELS, PLATFORM_LABELS, STATUS_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateTimeField, toDateTimeLocalValue } from '@/components/ui/DateTimeField'
import { PlatformPicker } from '@/components/planner/PlatformPicker'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogIcon } from '@/components/ui/Dialog'
import { SocialPreview, type SocialPlatform } from '@/components/SocialPreview'
import { useThemeStore } from '@/stores/themeStore'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { assertUploadable, getErrorMessage } from '@/lib/errors'
import { Page } from '@/components/layout/Page'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/DropdownMenu'
import { EditorSection } from '@/components/content/EditorSection'
import { editorSnapshot, sameEditorSnapshot, mergeEditorResponse, initialEditorPreview, type EditorSnapshot } from '@/components/content/editorState'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

const EDITABLE_STATUSES = ['DRAFT', 'IN_PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED']

type PublishablePlatform = 'FACEBOOK' | 'INSTAGRAM' | 'INSTAGRAM_STORY' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE' | 'WHATSAPP'

export function ContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { mode } = useThemeStore()
  const [content, setContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<EditorSnapshot | null>(null)
  const baselineRef = useRef<EditorSnapshot | null>(null)
  const currentId = useRef(id)
  currentId.current = id
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [platformsBusy, setPlatformsBusy] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [requestingApproval, setRequestingApproval] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sections, setSections] = useState({ copy: true, networks: false, schedule: false, brief: false, comments: false })
  const toolbarRef = useRef<HTMLElement>(null)
  const [toolbarHeight, setToolbarHeight] = useState(96)

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
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>(() => {
    const requested = location.state?.previewPlatform
    if (requested === 'INSTAGRAM_STORY') return 'STORY'
    return ['INSTAGRAM', 'FACEBOOK', 'STORY', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'WHATSAPP'].includes(requested) ? requested : 'INSTAGRAM'
  })
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
  const [sendingComment, setSendingComment] = useState(false)
  const isDirty = Boolean(content && savedSnapshot && !sameEditorSnapshot(editorSnapshot(content), savedSnapshot))
  const allowNextNavigation = useUnsavedChanges(isDirty || Boolean(newComment.trim()))

  useEffect(() => {
    if (loading || !toolbarRef.current) return
    const observer = new ResizeObserver(([entry]) => setToolbarHeight(Math.ceil(entry.target.getBoundingClientRect().height)))
    observer.observe(toolbarRef.current)
    return () => observer.disconnect()
  }, [loading])

  const applyServerContent = (data: any) => {
    if (data.id !== currentId.current) return
    const baseline = baselineRef.current
    setContent((previous: any) => mergeEditorResponse(previous, data, baseline))
    const snapshot = editorSnapshot(data)
    baselineRef.current = snapshot
    setSavedSnapshot(snapshot)
  }
  const updateField = (field: keyof EditorSnapshot, value: string | null) => {
    setContent((previous: any) => previous ? { ...previous, [field]: value } : previous)
    setSaveError('')
  }

  // Social publishing
  const [connections, setConnections] = useState<any[]>([])
  const [publishing, setPublishing] = useState<PublishablePlatform | null>(null)
  const [sendingWhatsAppContent, setSendingWhatsAppContent] = useState(false)

  const loadContent = async () => {
    try {
      const { data } = await api.get(`/contents/${id}`)
      if (id !== currentId.current) return
      applyServerContent(data)
      setLoadError(false)
      setComments(data.comments || [])
      if (data.clientId) {
        api.get('/social/connections', { params: { clientId: data.clientId } })
          .then((res) => { if (id === currentId.current) setConnections(res.data || []) })
          .catch(() => { if (id === currentId.current) setConnections([]) })
      }
    } catch (err) {
      if (id === currentId.current) setLoadError(true)
    } finally {
      if (id === currentId.current) setLoading(false)
    }
  }

  // WhatsApp Status publishes in the background: while it runs, refresh only the platform states
  // (never the fields being edited) so the banner disappears and the result shows by itself.
  const whatsAppInProgress = (content?.platforms || []).some((p: any) => p.platform === 'WHATSAPP' && p.status === 'PUBLISHING')
  useEffect(() => {
    if (!whatsAppInProgress) return
    const timer = window.setInterval(async () => {
      try {
        const { data } = await api.get(`/contents/${id}`)
        if (id !== currentId.current) return
        setContent((previous: any) => previous?.id === data.id ? { ...previous, platforms: data.platforms, status: data.status, publishedAt: data.publishedAt } : previous)
      } catch { /* try again on the next tick */ }
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [whatsAppInProgress, id])

  useEffect(() => {
    setLoading(true)
    setContent(null)
    baselineRef.current = null
    setSavedSnapshot(null)
    setLastSavedAt(null)
    setSaveError('')
    setAiHooks([])
    setNewComment('')
    setConnections([])
    void loadContent()
  }, [id])

  useEffect(() => {
    if (content?.id) setPreviewPlatform(initialEditorPreview(content, location.state?.previewPlatform) as SocialPlatform)
  }, [content?.id])

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
      if (data.queued) {
        // WhatsApp Status runs in the background (it can take a few minutes).
        toast.info('A publicar no Status do WhatsApp', 'Pode demorar 1 a 3 minutos. Pode continuar a trabalhar — vai receber uma notificação quando terminar.')
      } else if (data.externalPostUrl) {
        const openPost = await confirmDialog({
          title: 'Publicado com sucesso',
          description: `Quer abrir o post no ${label} para conferir?`,
          confirmLabel: 'Abrir post',
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
    if (saving || !isDirty) return
    const submitted = editorSnapshot(content)
    setSaveError('')
    setSaving(true)
    try {
      const { data } = await api.patch(`/contents/${id}`, {
        title: content.title,
        brief: content.brief,
        hook: content.hook,
        caption: content.caption,
        cta: content.cta,
        status: content.status,
        scheduledAt: content.scheduledAt,
      })
      if (id !== currentId.current) return
      applyServerContent(data)
      if (!sameEditorSnapshot(submitted, editorSnapshot(data))) {
        setSaveError('Algumas alterações não foram guardadas. Verifique a data agendada e tente novamente.')
        setSections(previous => ({ ...previous, schedule: true }))
        return
      }
      setLastSavedAt(new Date())
      toast.success('Conteúdo salvo com sucesso!')
    } catch (err) {
      setSaveError('Não foi possível guardar. As alterações continuam no editor; tente novamente.')
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
      allowNextNavigation()
      navigate('/app/content')
    } catch (err) {
      toast.error('Erro ao excluir conteúdo', getErrorMessage(err))
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (statusBusy) return
    setStatusBusy(true)
    try {
      const { data } = await api.post(`/contents/${id}/change-status`, { status: newStatus })
      applyServerContent(data)
    } catch (err) {
      toast.error('Erro ao alterar status', getErrorMessage(err))
    } finally { setStatusBusy(false) }
  }

  // Platform selection used to only exist at content-creation time — once inside the
  // Workspace there was no way to see or change which network(s) a post targets. Reuses the
  // same PlatformPicker from creation; each toggle hits the dedicated platform endpoints
  // immediately (add/remove), matching how they already work (see content.routes.ts), then
  // re-syncs from the server rather than hand-merging optimistic state.
  const handleTogglePlatforms = async (nextPlatforms: string[]) => {
    if (platformsBusy) return
    setPlatformsBusy(true)
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
      setPlatformsBusy(false)
    }
  }

  const handleGenerateCaption = async () => {
    setGeneratingCaption(true)
    try {
      const { data } = await api.post('/ai/generate-caption', {
        clientId: content.clientId,
        contentId: content.id,
        // Title + brief together: the caption must develop exactly this post's theme.
        brief: [`Título do post: ${content.title}`, content.brief && `Briefing: ${content.brief}`].filter(Boolean).join('. '),
        contentType: content.contentType,
        platform: (content.platforms || []).filter((p: any) => p.enabled !== false).map((p: any) => p.platform).join(', ') || undefined,
      })
      setContent((previous: any) => previous?.id === content.id ? ({ ...previous,
        caption: data.caption || previous.caption, hook: data.hook || previous.hook, cta: data.cta || previous.cta,
      }) : previous)
      setSections(previous => ({ ...previous, copy: true }))
    } catch (err) {
      toast.error('Erro ao gerar legenda com Brand Brain', getErrorMessage(err))
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
      setSections(previous => ({ ...previous, copy: true }))
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
      toast.error('Erro ao gerar proposta de imagem com Brand Brain', getErrorMessage(err))
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleUploadCreative = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    // Size/format checked before uploading: the user sees exactly which file is the problem.
    try { assertUploadable(files) } catch (err) {
      toast.error('Não foi possível enviar o criativo', getErrorMessage(err))
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
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
    try { assertUploadable(accepted) } catch (err) {
      toast.error('Não foi possível adicionar as imagens', getErrorMessage(err))
      if (addMoreInputRef.current) addMoreInputRef.current.value = ''
      return
    }
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
    if (requestingApproval) return
    setRequestingApproval(true)
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
      setContent((previous: any) => previous ? { ...previous, status: 'CLIENT_REVIEW' } : previous)
    } catch (err) {
      toast.error('Erro ao gerar link de aprovação', getErrorMessage(err))
    } finally { setRequestingApproval(false) }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || sendingComment) return
    setSendingComment(true)
    try {
      const { data } = await api.post(`/contents/${id}/comments`, { comment: newComment })
      setComments(previous => [...previous, data])
      setNewComment('')
    } catch (err) {
      toast.error('Erro ao adicionar comentário', getErrorMessage(err))
    } finally { setSendingComment(false) }
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

  if (!loading && !content && loadError) return <Page><div role="alert" className="space-y-4 rounded-xl border border-border bg-card p-6"><h1 className="text-lg font-semibold">Não foi possível abrir o criativo</h1><p className="text-sm text-muted-foreground">Verifique a ligação e tente novamente.</p><div className="flex gap-2"><Button onClick={() => { setLoading(true); void loadContent() }}>Tentar novamente</Button><Button asChild variant="outline"><Link to="/app/content">Voltar para criativos</Link></Button></div></div></Page>

  if (loading || !content) {
    return (
      <Page>
        <Skeleton className="h-8 w-1/4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </Page>
    )
  }

  // The content's current active set (role: 'PRIMARY', set by setContentPrimaryAssets on the
  // backend), in carousel order — NOT filtered to images only, since video is required for
  // TikTok/YouTube and common for Reels; the preview branches on mimeType to render <video> vs
  // <img>. For CAROUSEL content this can be 2+ images; for everything else it's always 0 or 1.
  const primaryMediaList = (content.assets || [])
    .filter((a: any) => a.role === 'PRIMARY' && a.asset?.publicUrl)
    .slice()
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((a: any) => a.asset)
  const primaryMedia = primaryMediaList[0] || null

  const selectedPlatforms = (content.platforms || []).map((p: any) => p.platform)
  const previewSelected = selectedPlatforms.includes(previewPlatform === 'STORY' ? 'INSTAGRAM' : previewPlatform)
  const aiBusy = generatingCaption || generatingHooks || generatingImage
  const toggleSection = (key: keyof typeof sections) => setSections(previous => ({ ...previous, [key]: !previous[key] }))
  const preview = <SocialPreview
    clientName={content.client?.name} clientLogoUrl={content.client?.logoUrl}
    title={content.title} hook={content.hook} caption={content.caption} cta={content.cta}
    contentType={content.contentType} image={primaryMedia} mediaList={primaryMediaList}
    generating={generatingImage} uploadProgress={uploadProgress} selectedPlatforms={selectedPlatforms}
    value={previewPlatform} onChange={setPreviewPlatform} dark={mode === 'dark'}
  />
  const saveMessage = saving ? 'A guardar alterações…' : saveError || (isDirty ? 'Alterações por guardar' : lastSavedAt
    ? `Guardado às ${lastSavedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`
    : 'Sem alterações por guardar')

  return (
    <Page className="space-y-5 !pt-0">
      <div style={{ '--editor-toolbar-height': `${toolbarHeight}px` } as React.CSSProperties} className="min-w-0 space-y-5">
      <header ref={toolbarRef} className="sticky top-0 z-20 -mx-1 border-b border-border bg-background/95 px-1 py-3 backdrop-blur-md sm:py-5">
        <div className="flex flex-col justify-between gap-3 sm:gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="hidden shrink-0 lg:inline-flex"><Link to="/app/content" aria-label="Voltar para criativos"><ArrowLeft size={19} /></Link></Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Editar criativo</h1><StatusBadge status={content.status} /></div>
              <p className="mt-1 truncate text-xs text-muted-foreground sm:text-[13px]">{content.client?.name || 'Cliente'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button size="sm" onClick={handleSave} loading={saving} disabled={!isDirty || saving || platformsBusy || statusBusy} className="gap-1.5 px-2 sm:px-2.5"><Save size={14} />{saving ? 'A guardar…' : 'Guardar'}</Button>
            <Button size="sm" variant="outline" onClick={handleRequestApproval} loading={requestingApproval} disabled={saving || requestingApproval} className="px-2 sm:px-2.5"><Share2 size={14} /><span>Aprovação</span></Button>
            <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)} aria-label="Preview social" className="size-9 p-2 sm:w-auto sm:px-3 xl:hidden"><Eye size={15} /><span className="hidden sm:inline">Preview</span></Button>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Mais ações"><MoreHorizontal size={19} /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Este criativo</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()} disabled={uploadingCreative || assetsBusy}><Upload size={15} />Enviar criativo</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleSendWhatsAppContent()} disabled={sendingWhatsAppContent}><MessageCircle size={15} />{sendingWhatsAppContent ? 'A enviar…' : 'Enviar por WhatsApp'}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleDeleteContent()} className="text-error-dark dark:text-error-light"><Trash2 size={15} />Excluir conteúdo</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p role="status" aria-live="polite" className={cn('mt-2 text-xs leading-5 sm:mt-3', !isDirty && !saving && !saveError && 'hidden sm:block', saveError ? 'text-error-dark dark:text-error-light' : isDirty ? 'text-warning-dark dark:text-warning-light' : 'text-muted-foreground')}>{saveMessage}{newComment.trim() && <span className="text-muted-foreground"> · Comentário por enviar</span>}</p>
      </header>
      {whatsAppInProgress && (
        <div role="status" className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm">
          <Loader2 size={16} className="shrink-0 animate-spin text-primary" aria-hidden />
          <span>A publicar no Status do WhatsApp… pode demorar alguns minutos. Vai receber uma notificação quando terminar.</span>
        </div>
      )}
      {(content.platforms || []).some((platform: any) => platform.status === 'FAILED') && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-error/20 bg-error/5 px-4 py-3">
          <XCircle size={18} aria-hidden className="mt-0.5 shrink-0 text-error-dark dark:text-error-light" />
          <div><p className="text-sm font-medium">Falha de publicação em {(content.platforms || []).filter((platform: any) => platform.status === 'FAILED').map((platform: any) => PLATFORM_LABELS[platform.platform] || platform.platform).join(', ')}.</p>{(content.platforms || []).filter((platform: any) => platform.status === 'FAILED' && platform.publishError).map((platform: any) => <p key={platform.id || platform.platform} className="mt-1 text-xs leading-5 text-foreground/80"><span className="font-semibold">{PLATFORM_LABELS[platform.platform] || platform.platform}:</span> {platform.publishError}</p>)}<p className="mt-1 text-xs leading-5 text-muted-foreground">Reveja o conteúdo e a conexão da plataforma antes de voltar a publicar.</p></div>
        </div>
      )}

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-3 xl:order-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-sm font-semibold">Editor</h2>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={aiBusy} aria-label="Ferramentas de IA — Brand Brain"><Sparkles size={14} className="text-primary" />{aiBusy ? 'A gerar…' : 'Brand Brain'}</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Assistente de conteúdo</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => void handleGenerateCaption()}><AlignLeft size={15} />Gerar legenda</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleGenerateHooks()}><Sparkles size={15} />Sugerir hooks</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Direção visual</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => void handleGenerateImage()}><ImagePlus size={15} />Gerar criativo</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <EditorSection title="Conteúdo e legenda" summary="Título, mensagem e chamada para ação" open={sections.copy} onToggle={() => toggleSection('copy')}>
            <div><Label htmlFor="contentTitle">Título do post</Label><Input id="contentTitle" value={content.title || ''} onChange={e => updateField('title', e.target.value)} className="font-medium" /></div>
            <div><Label htmlFor="contentHook">Hook / gancho inicial</Label><Input id="contentHook" value={content.hook || ''} placeholder="Primeira linha da publicação" onChange={e => updateField('hook', e.target.value)} /></div>
            {aiHooks.length > 0 && <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Hooks sugeridos · selecione para aplicar</p>{aiHooks.map((hook, i) => <Button key={i} variant="ghost" className="h-auto w-full justify-start whitespace-normal bg-muted/50 px-3 py-2 text-left text-xs font-normal" onClick={() => updateField('hook', hook)}>{hook}</Button>)}</div>}
            <div><div className="flex items-center justify-between gap-2"><Label htmlFor="contentCaption">Legenda principal</Label><span className="text-[11px] tabular-nums text-muted-foreground">{(content.caption || '').length.toLocaleString('pt-PT')} caracteres</span></div><Textarea id="contentCaption" rows={8} value={content.caption || ''} placeholder="Escreva a legenda ou use o Brand Brain…" onChange={e => updateField('caption', e.target.value)} className="min-h-48 py-3 leading-relaxed" /></div>
            <div><Label htmlFor="contentCta">Chamada para ação (CTA)</Label><Input id="contentCta" value={content.cta || ''} placeholder="O que o público deve fazer a seguir?" onChange={e => updateField('cta', e.target.value)} /></div>
          </EditorSection>
          <EditorSection title="Redes sociais e estado" summary={selectedPlatforms.length ? selectedPlatforms.map((p: string) => PLATFORM_LABELS[p] || p).join(' · ') : 'Nenhuma rede selecionada'} open={sections.networks} onToggle={() => toggleSection('networks')}>
            <fieldset disabled={platformsBusy || saving || statusBusy} className="min-w-0 space-y-3"><legend className="mb-2 text-xs font-medium">Plataformas de publicação</legend><PlatformPicker value={selectedPlatforms} onChange={handleTogglePlatforms} disabled={platformsBusy || saving || statusBusy} /></fieldset>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="contentStatus">Estado do conteúdo</Label><Select value={content.status} onValueChange={handleStatusChange} disabled={statusBusy || saving || platformsBusy}><SelectTrigger id="contentStatus"><SelectValue /></SelectTrigger><SelectContent>{EDITABLE_STATUSES.map(status => <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>)}</SelectContent></Select></div><div><p className="mb-1.5 text-xs font-medium">Formato atual</p><p className="flex h-10 items-center text-sm text-muted-foreground">{CONTENT_TYPE_LABELS[content.contentType]}</p></div></div>
            <p role="status" className="text-xs leading-5 text-muted-foreground">{platformsBusy || statusBusy ? 'A atualizar…' : 'As redes e o estado são guardados imediatamente.'}</p>
          </EditorSection>
          <EditorSection title="Agendamento" summary={content.scheduledAt ? new Date(content.scheduledAt).toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sem data definida'} open={sections.schedule} onToggle={() => toggleSection('schedule')}>
            <div><Label htmlFor="contentScheduledAt">Data e hora agendada</Label><DateTimeField id="contentScheduledAt" className="flex-wrap sm:flex-nowrap [&>input]:basis-full sm:[&>input]:basis-auto" value={content.scheduledAt ? toDateTimeLocalValue(content.scheduledAt) : ''} onChange={value => updateField('scheduledAt', value ? new Date(value).toISOString() : null)} /></div>
            <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><CalendarDays size={15} className="mt-0.5 shrink-0" /><span>Horário local · {Intl.DateTimeFormat().resolvedOptions().timeZone}. Guarde as alterações para confirmar a data. A seleção da data mantém o estado atual do conteúdo.</span></p>
          </EditorSection>
          <EditorSection title="Briefing e orientações" summary="Contexto e direção criativa para a equipa e o Brand Brain" open={sections.brief} onToggle={() => toggleSection('brief')}>
            <div><Label htmlFor="contentBrief">Briefing e orientações visuais</Label><Textarea id="contentBrief" rows={5} value={content.brief || ''} onChange={e => updateField('brief', e.target.value)} placeholder="Objetivo, público e orientações para este criativo…" /></div>
          </EditorSection>
          <EditorSection title="Comentários internos" summary={newComment.trim() ? 'Comentário por enviar' : comments.length ? `${comments.length} comentários` : 'Converse com a equipa sobre este conteúdo'} open={sections.comments} onToggle={() => toggleSection('comments')}>
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
                aria-label="Novo comentário interno"
                disabled={sendingComment}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escreva uma observação…"
                className="flex-1 px-3 py-2"
              />
              <Button type="submit" size="icon" aria-label="Enviar comentário" loading={sendingComment} disabled={!newComment.trim()}>
                <Send size={14} />
              </Button>
            </form>

          </EditorSection>
        </div>
        <aside aria-label="Preview social e mídia" className="order-first min-w-0 xl:order-1 xl:sticky xl:top-[calc(var(--editor-toolbar-height)+1rem)]">
          <Card className="min-w-0 space-y-4 xl:max-h-[calc(100dvh-5rem-var(--editor-toolbar-height))] xl:overflow-y-auto" tabIndex={0} role="region" aria-label="Mídia e pré-visualização">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Preview e mídia</h2>
              <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{CONTENT_TYPE_LABELS[content.contentType]}</span><Button size="icon" variant="ghost" aria-label="Ampliar preview" onClick={() => setPreviewOpen(true)}><Maximize2 size={15} /></Button></div>
            </div>
            {/* Main action first: publish right above the post */}
            <div className="empty:hidden">
              {previewSelected && (previewPlatform === 'FACEBOOK' || previewPlatform === 'INSTAGRAM' || previewPlatform === 'STORY') && (() => {
                const targetPlatform = previewPlatform === 'STORY' ? 'INSTAGRAM_STORY' : previewPlatform
                const connectionPlatform = previewPlatform === 'STORY' ? 'INSTAGRAM' : previewPlatform
                return connections.some((c) => c.platform === connectionPlatform && c.status === 'ACTIVE') ? (
                  <Button
                    size="sm"
                    onClick={() => handlePublish(targetPlatform)}
                    loading={publishing === targetPlatform}
                    className="w-full gap-1.5"
                  >
                    {publishing === targetPlatform ? (
                      <span>Publicando…</span>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>Publicar {previewPlatform === 'STORY' ? 'Story no Instagram' : `no ${connectionPlatform === 'FACEBOOK' ? 'Facebook' : 'Instagram'}`}</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="block rounded-lg bg-muted/50 px-3 py-2.5 text-center text-xs text-muted-foreground">
                    Conecte o {connectionPlatform === 'FACEBOOK' ? 'Facebook' : 'Instagram'} em Configurações para publicar direto
                  </span>
                )
              })()}

              {previewSelected && (previewPlatform === 'LINKEDIN' || previewPlatform === 'TIKTOK' || previewPlatform === 'YOUTUBE' || previewPlatform === 'WHATSAPP') && (() => {
                const targetPlatform = previewPlatform as PublishablePlatform
                const label = PLATFORM_PUBLISH_LABEL[targetPlatform]
                return connections.some((c) => c.platform === targetPlatform && c.status === 'ACTIVE') ? (
                  <Button
                    size="sm"
                    onClick={() => handlePublish(targetPlatform)}
                    loading={publishing === targetPlatform}
                    className="w-full gap-1.5"
                  >
                    {publishing === targetPlatform ? (
                      <span>
                        {targetPlatform === 'WHATSAPP'
                          ? primaryMediaList.length > 1
                            ? `Publicando ${primaryMediaList.length} imagens... pode levar vários minutos`
                            : 'Publicando... pode levar até 1 minuto'
                          : 'Publicando…'}
                      </span>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>Publicar no {label}</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="block rounded-lg bg-muted/50 px-3 py-2.5 text-center text-xs text-muted-foreground">
                    Conecte o {label} em Configurações para publicar direto
                  </span>
                )
              })()}
            </div>
            <div className="hidden xl:block">{preview}</div>
            <button type="button" onClick={() => setPreviewOpen(true)} className="flex w-full items-center gap-3 rounded-lg bg-muted/50 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 xl:hidden">
              {primaryMedia && !primaryMedia.mimeType?.startsWith('video/') ? <img src={primaryMedia.publicUrl} alt="" className="size-14 rounded-md object-contain" /> : <Eye size={24} className="m-3 shrink-0 text-muted-foreground" />}
              <span><span className="block text-sm font-medium">Abrir preview social</span><span className="mt-1 block text-xs text-muted-foreground">{selectedPlatforms.length ? 'Ver conteúdo nas redes selecionadas' : 'Selecione uma rede no editor'}</span></span>
            </button>
            {isDirty && <p className="text-xs leading-5 text-warning-dark dark:text-warning-light">O preview inclui alterações por guardar. Guarde antes de publicar ou pedir aprovação.</p>}
            {/* Image controls */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
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
                <div className="-mt-1 flex items-center gap-2 overflow-x-auto">
                  {uploadingCreative ? (
                    // Replacing the whole set — show only the incoming files as placeholders,
                    // since whatever's currently attached is about to be superseded.
                    pendingPreviews.map((url, i) => (
                      <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
                        <img src={url} alt={`Novo ${i + 1}`} className="w-full h-full object-cover opacity-40" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                        <span className="absolute bottom-0.5 right-0.5 bg-[#000]/60 text-[#fff] text-[11px] font-bold px-1 rounded">{i + 1}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      {primaryMediaList.map((m: any, i: number) => (
                        <div key={m.id ?? i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0 group">
                          <img src={m.publicUrl} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0.5 right-0.5 bg-[#000]/60 text-[#fff] text-[11px] font-bold px-1 rounded">{i + 1}</span>
                          <button
                            type="button"
                            title="Remover imagem"
                            aria-label={`Remover imagem ${i + 1}`}
                            disabled={assetsBusy || primaryMediaList.length <= 1}
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
                          title="Adicionar imagens" aria-label="Adicionar imagens"
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
        </aside>
      </div>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}><DialogContent size="lg"><DialogHeader><DialogTitle>Preview social</DialogTitle><DialogDescription>{content.client?.name} · {CONTENT_TYPE_LABELS[content.contentType]} · {content.title}</DialogDescription></DialogHeader>{preview}<p className="text-xs leading-5 text-muted-foreground">Simulação do conteúdo atual. A apresentação final pode variar entre plataformas.</p></DialogContent></Dialog>
      {/* Client Approval Modal */}
      <Dialog open={approvalModal} onOpenChange={setApprovalModal}>
        <DialogContent>
          <DialogHeader icon={<DialogIcon className="border-transparent bg-warning/10 text-warning-dark"><Share2 size={22} /></DialogIcon>}>
                <DialogTitle>Link de aprovação gerado</DialogTitle>
                <DialogDescription>Envie este link direto para o cliente aprovar sem login</DialogDescription>
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
    </Page>
  )
}
