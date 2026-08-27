import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle2, AlertTriangle, XCircle, Send,
  Calendar, Check, Zap, Sun, Moon
} from 'lucide-react'
import api from '@/lib/api'
import { CONTENT_TYPE_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { SocialPreview } from '@/components/SocialPreview'
import { useThemeStore } from '@/stores/themeStore'

export function ApprovalPortalPage() {
  const { token } = useParams<{ token: string }>()
  const { mode, toggle } = useThemeStore()
  const isDark = mode === 'dark'
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionDone, setActionDone] = useState('')

  // Form states
  const [actorName, setActorName] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showChangesModal, setShowChangesModal] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/approvals/portal/${token}`)
        setData(res.data)
        api.post(`/approvals/portal/${token}/view`).catch(() => {})
      } catch (err: any) {
        setError(err.response?.data?.error || 'Link de aprovação inválido ou expirado.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      await api.post(`/approvals/portal/${token}/approve`, {
        actorName: actorName || 'Cliente',
        comment: comment || 'Aprovado pelo cliente.',
      })
      setActionDone('APPROVED')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao aprovar.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) {
      alert('Por favor, descreva as alterações desejadas.')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/approvals/portal/${token}/request-changes`, {
        actorName: actorName || 'Cliente',
        comment,
      })
      setActionDone('CHANGES_REQUESTED')
      setShowChangesModal(false)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao solicitar alterações.')
    } finally {
      setSubmitting(false)
    }
  }

  const ThemeToggle = (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      className="w-10 h-10 shrink-0 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 font-sans text-foreground">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando conteúdo para aprovação...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 font-sans text-foreground">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-dialog">
          <XCircle className="w-12 h-12 text-error mx-auto" />
          <h2 className="text-lg font-extrabold">Link Indisponível</h2>
          <p className="text-sm text-muted-foreground">{error || 'Não foi possível encontrar a solicitação.'}</p>
        </div>
      </div>
    )
  }

  const content = data.content
  const images = (content.assets || [])
    .filter((a: any) => a.asset?.mimeType?.startsWith('image/'))
    .slice()
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const primaryImage = images[0]?.asset || null
  const isVertical = content.contentType === 'STORY' || content.contentType === 'REEL'

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-4 sm:p-8 flex flex-col justify-between">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Client Brand Header */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-card">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary font-extrabold flex items-center justify-center text-base border border-primary/30 overflow-hidden">
              {data.client?.logoUrl ? (
                <img src={data.client.logoUrl} alt={data.client.name} className="w-full h-full object-cover" />
              ) : (
                data.client?.name?.[0] || 'C'
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Portal de Aprovação</p>
              <h1 className="text-xl font-extrabold text-foreground">{data.client?.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {content.scheduledAt && (
              <span className="flex items-center gap-1.5 bg-background px-3 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground">
                <Calendar size={13} className="text-primary" />
                <span>Previsto para {new Date(content.scheduledAt).toLocaleDateString('pt-BR')}</span>
              </span>
            )}
            {ThemeToggle}
          </div>
        </div>

        {/* Action Confirmation Banner */}
        {actionDone && (
          <div
            className={`p-6 rounded-2xl border text-center space-y-2 shadow-card animate-fade-in ${
              actionDone === 'APPROVED'
                ? 'bg-success/10 border-success/30'
                : 'bg-warning/10 border-warning/30'
            }`}
          >
            {actionDone === 'APPROVED' ? (
              <>
                <CheckCircle2 className="w-12 h-12 mx-auto text-success mb-2" />
                <h3 className="text-lg font-extrabold text-foreground">Conteúdo Aprovado com Sucesso!</h3>
                <p className="text-sm text-muted-foreground font-medium">
                  A equipe da agência já foi notificada e dará andamento à publicação.
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-12 h-12 mx-auto text-warning mb-2" />
                <h3 className="text-lg font-extrabold text-foreground">Alterações Solicitadas!</h3>
                <p className="text-sm text-muted-foreground font-medium">
                  Suas observações foram salvas na memória da marca para orientar a equipe.
                </p>
              </>
            )}
          </div>
        )}

        {/* Post Preview Card — simulates exactly how it will look once published */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-muted-foreground uppercase tracking-wider">
              {content.title}
            </h2>
            <Badge variant="primary">{CONTENT_TYPE_LABELS[content.contentType] || content.contentType}</Badge>
          </div>

          <div className="p-4 sm:p-6">
            <SocialPreview
              clientName={data.client?.name}
              clientLogoUrl={data.client?.logoUrl}
              title={content.title}
              hook={content.hook}
              caption={content.caption}
              cta={content.cta}
              image={primaryImage}
              defaultPlatform={isVertical ? 'STORY' : 'INSTAGRAM'}
              dark={isDark}
            />
          </div>
        </div>

        {/* Action Controls */}
        {!actionDone && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-card">
            <h3 className="text-sm font-extrabold text-foreground">Sua Decisão:</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="actorName" className="text-muted-foreground mb-1.5">Seu Nome (Opcional)</Label>
                <Input
                  id="actorName"
                  type="text"
                  placeholder="Ex: Carlos (Diretoria)"
                  value={actorName}
                  onChange={(e) => setActorName(e.target.value)}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-primary/40"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <Button
                  variant="ghost"
                  onClick={handleApprove}
                  disabled={submitting}
                  className="w-full sm:flex-1 justify-center bg-success hover:bg-success-dark text-[#fff] hover:text-[#fff]"
                >
                  <Check size={16} />
                  <span>Aprovar Post</span>
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setShowChangesModal(true)}
                  disabled={submitting}
                  className="w-full sm:flex-1 justify-center bg-muted hover:bg-grey-300 text-foreground hover:text-foreground border border-border"
                >
                  <AlertTriangle size={15} className="text-warning" />
                  <span>Pedir Ajuste</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Changes Modal */}
      <Dialog open={showChangesModal} onOpenChange={setShowChangesModal}>
        <DialogContent hideClose className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/20 text-warning flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <DialogTitle className="text-foreground">Solicitar Alterações</DialogTitle>
                <DialogDescription>O que você gostaria de mudar neste conteúdo?</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleRequestChanges} className="space-y-4">
            <Textarea
              rows={4}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Descreva aqui o que precisa ser ajustado (imagem, legenda, tom de voz)..."
              className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-primary/40"
            />

            <DialogFooter className="border-border">
              <Button type="button" variant="ghost" onClick={() => setShowChangesModal(false)} className="text-muted-foreground hover:text-foreground hover:bg-transparent">
                Cancelar
              </Button>
              <Button type="submit" variant="ghost" disabled={submitting} className="bg-warning hover:bg-warning-dark text-warning-foreground hover:text-warning-foreground">
                <Send size={14} />
                <span>Enviar Ajustes</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground mt-12 py-4">
        <span className="flex items-center justify-center gap-2">
          Powered by
          <span className="flex items-center gap-1 font-bold text-foreground/80">
            <Zap size={13} className="text-primary" />
            AgencyOS
          </span>
          — Sistema Operacional de Agências
        </span>
      </footer>
    </div>
  )
}
