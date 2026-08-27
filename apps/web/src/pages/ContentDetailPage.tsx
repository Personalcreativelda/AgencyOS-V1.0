import React, { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Sparkles, Send, Copy, ImagePlus, Upload,
  MessageSquare, Share2, Check, RefreshCw, Mail, MessageCircle, XCircle
} from 'lucide-react'
import api from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CONTENT_TYPE_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { SocialPreview, type SocialPlatform } from '@/components/SocialPreview'
import { useThemeStore } from '@/stores/themeStore'

export function ContentDetailPage() {
  const { id } = useParams<{ id: string }>()
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
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>('INSTAGRAM')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Approval Link State
  const [approvalModal, setApprovalModal] = useState(false)
  const [approvalUrl, setApprovalUrl] = useState('')
  const [approvalSent, setApprovalSent] = useState<{ emailSent: boolean; emailError?: string; whatsappSent: boolean; whatsappError?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Comments
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')

  // Social publishing
  const [connections, setConnections] = useState<any[]>([])
  const [publishing, setPublishing] = useState<'FACEBOOK' | 'INSTAGRAM' | null>(null)

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

  const handlePublish = async (platform: 'FACEBOOK' | 'INSTAGRAM') => {
    if (!confirm(`Publicar este conteúdo agora no ${platform === 'FACEBOOK' ? 'Facebook' : 'Instagram'}? Isso vai ao ar imediatamente.`)) return
    setPublishing(platform)
    try {
      await api.post('/social/publish', { contentId: content.id, platform })
      alert('Publicado com sucesso!')
      await loadContent()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao publicar.')
    } finally {
      setPublishing(null)
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
      alert('Conteúdo salvo com sucesso!')
    } catch (err) {
      alert('Erro ao salvar conteúdo.')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { data } = await api.post(`/contents/${id}/change-status`, { status: newStatus })
      setContent({ ...content, status: data.status })
    } catch (err) {
      alert('Erro ao alterar status.')
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
      alert('Erro ao gerar legenda com IA.')
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
      alert('Erro ao gerar hooks.')
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
      alert('Erro ao gerar proposta de imagem com IA.')
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleUploadCreative = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCreative(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', content.clientId)
      formData.append('contentId', content.id)
      formData.append('type', 'IMAGE')
      await api.post('/assets/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      await loadContent()
    } catch (err) {
      alert('Erro ao enviar o criativo.')
    } finally {
      setUploadingCreative(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRequestApproval = async () => {
    try {
      const { data } = await api.post(`/approvals/contents/${id}/request`, {
        expiresInDays: 7,
      })
      setApprovalUrl(data.portalUrl)
      setApprovalSent(data.sent || null)
      setApprovalModal(true)
      setContent({ ...content, status: 'CLIENT_REVIEW' })
    } catch (err) {
      alert('Erro ao gerar link de aprovação.')
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
      alert('Erro ao adicionar comentário.')
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(approvalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  const images = (content.assets || [])
    .filter((a: any) => a.asset?.mimeType?.startsWith('image/'))
    .slice()
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const primaryImage = images[0]?.asset || null

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

          <Button onClick={handleSave} loading={saving}>
            {!saving && <span>Salvar Alterações</span>}
            {saving && <span>Salvando...</span>}
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
              image={primaryImage}
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
                disabled={uploadingCreative}
                className="gap-1.5"
              >
                <Upload size={13} />
                <span>{uploadingCreative ? 'Enviando...' : 'Enviar Criativo'}</span>
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadCreative} />

              {(previewPlatform === 'FACEBOOK' || previewPlatform === 'INSTAGRAM') && (
                connections.some((c) => c.platform === previewPlatform && c.status === 'ACTIVE') ? (
                  <Button
                    size="sm"
                    onClick={() => handlePublish(previewPlatform)}
                    loading={publishing === previewPlatform}
                    className="gap-1.5 ml-auto"
                  >
                    {publishing !== previewPlatform && (
                      <>
                        <Send size={13} />
                        <span>Publicar no {previewPlatform === 'FACEBOOK' ? 'Facebook' : 'Instagram'}</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground font-medium ml-auto">
                    Conecte o {previewPlatform === 'FACEBOOK' ? 'Facebook' : 'Instagram'} em Configurações para publicar direto
                  </span>
                )
              )}
            </div>
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
                    className="w-full justify-start text-left h-auto p-3 bg-muted hover:bg-primary/10 text-foreground hover:text-primary border border-border"
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
                <Input
                  id="contentScheduledAt"
                  type="datetime-local"
                  value={content.scheduledAt ? new Date(content.scheduledAt).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setContent({ ...content, scheduledAt: e.target.value })}
                  className="py-2"
                />
              </div>
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

          {approvalSent && (approvalSent.emailSent || approvalSent.whatsappSent || approvalSent.emailError || approvalSent.whatsappError) && (
            <div className="space-y-1.5 text-xs">
              {(approvalSent.emailSent || approvalSent.emailError) && (
                <div className={`flex items-center gap-2 p-2.5 rounded-xl font-semibold ${approvalSent.emailSent ? 'bg-success/10 text-success-dark' : 'bg-muted text-muted-foreground'}`}>
                  {approvalSent.emailSent ? <Mail size={14} className="shrink-0" /> : <XCircle size={14} className="shrink-0" />}
                  <span>{approvalSent.emailSent ? 'Enviado por email ao cliente' : `Não enviado por email${approvalSent.emailError ? ` — ${approvalSent.emailError}` : ' — configure o SMTP em Configurações'}`}</span>
                </div>
              )}
              {(approvalSent.whatsappSent || approvalSent.whatsappError) && (
                <div className={`flex items-center gap-2 p-2.5 rounded-xl font-semibold ${approvalSent.whatsappSent ? 'bg-success/10 text-success-dark' : 'bg-muted text-muted-foreground'}`}>
                  {approvalSent.whatsappSent ? <MessageCircle size={14} className="shrink-0" /> : <XCircle size={14} className="shrink-0" />}
                  <span>{approvalSent.whatsappSent ? 'Enviado por WhatsApp ao cliente' : `Não enviado por WhatsApp${approvalSent.whatsappError ? ` — ${approvalSent.whatsappError}` : ''}`}</span>
                </div>
              )}
            </div>
          )}

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
