import React, { useEffect, useState } from 'react'
import {
  Building, Users, Plus, Trash2, Sparkles, Eye, EyeOff, CheckCircle2, XCircle, Loader2,
  Share2, Facebook, Instagram, MessageCircle, QrCode, Unplug, Mail,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { uploadFile } from '@/lib/upload'
import { useAuthStore } from '@/stores/authStore'
import { ROLE_LABELS, getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { UploadableAvatar } from '@/components/ui/UploadableAvatar'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from '@/components/ui/Card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/Dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'

const TEXT_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini (rápido e barato)' },
  { value: 'gpt-4o', label: 'GPT-4o (mais qualidade)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
]

const IMAGE_MODELS = [
  { value: 'gpt-image-1', label: 'GPT Image 1 (modelo atual da OpenAI)' },
  { value: 'dall-e-3', label: 'DALL·E 3 (contas mais antigas)' },
  { value: 'dall-e-2', label: 'DALL·E 2 (mais barato, contas mais antigas)' },
]

export function SettingsPage() {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [agency, setAgency] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MANAGER')

  // AI integration
  const [aiSettings, setAiSettings] = useState<any>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [textModel, setTextModel] = useState('gpt-4o-mini')
  const [imageModel, setImageModel] = useState('gpt-image-1')
  const [savingAi, setSavingAi] = useState(false)
  const [testingAi, setTestingAi] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Social connections
  const [clients, setClients] = useState<any[]>([])
  const [socialClientId, setSocialClientId] = useState('')
  const [connections, setConnections] = useState<any[]>([])
  const [loadingConnections, setLoadingConnections] = useState(false)
  const [connectingMeta, setConnectingMeta] = useState(false)
  const [showWaModal, setShowWaModal] = useState(false)
  const [waQr, setWaQr] = useState<string | null>(null)
  const [waConnecting, setWaConnecting] = useState(false)
  const [waPolling, setWaPolling] = useState(false)

  // Meta App (bring-your-own) settings
  const [metaSettings, setMetaSettings] = useState<any>(null)
  const [metaAppIdInput, setMetaAppIdInput] = useState('')
  const [metaAppSecretInput, setMetaAppSecretInput] = useState('')
  const [showMetaSecret, setShowMetaSecret] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)

  // SMTP (bring-your-own email, for approval-request notifications)
  const [smtpSettings, setSmtpSettings] = useState<any>(null)
  const [smtpForm, setSmtpForm] = useState({ host: '', port: '587', secure: false, username: '', password: '', fromName: '', fromEmail: '' })
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [agRes, memRes, aiRes, cliRes, metaRes, smtpRes] = await Promise.all([
          api.get('/agencies/current'),
          api.get('/agencies/current/members'),
          api.get('/ai/settings'),
          api.get('/clients'),
          api.get('/social/meta/settings'),
          api.get('/email/settings'),
        ])
        setAgency(agRes.data)
        setMembers(memRes.data || [])
        setAiSettings(aiRes.data)
        setTextModel(aiRes.data.textModel || 'gpt-4o-mini')
        setImageModel(aiRes.data.imageModel || 'gpt-image-1')
        setClients(cliRes.data.data || [])
        if (cliRes.data.data?.length > 0) setSocialClientId(cliRes.data.data[0].id)
        setMetaSettings(metaRes.data)
        setSmtpSettings(smtpRes.data)
        if (smtpRes.data.configured) {
          setSmtpForm((prev) => ({
            ...prev,
            host: smtpRes.data.host || '',
            port: String(smtpRes.data.port || '587'),
            secure: !!smtpRes.data.secure,
            username: smtpRes.data.username || '',
            fromName: smtpRes.data.fromName || '',
            fromEmail: smtpRes.data.fromEmail || '',
          }))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (socialClientId) loadConnections(socialClientId)
  }, [socialClientId])

  // Land back here after the Meta OAuth redirect and show the result.
  useEffect(() => {
    if (searchParams.get('social_connected')) {
      const cid = searchParams.get('clientId')
      if (cid) setSocialClientId(cid)
      alert('Conta conectada com sucesso!')
      setSearchParams({}, { replace: true })
    } else if (searchParams.get('social_error')) {
      alert('Não foi possível conectar a conta. Tente novamente.')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  const loadConnections = async (clientId: string) => {
    setLoadingConnections(true)
    try {
      const { data } = await api.get('/social/connections', { params: { clientId } })
      setConnections(data || [])
    } catch {
      setConnections([])
    } finally {
      setLoadingConnections(false)
    }
  }

  const handleSaveMetaSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!metaAppIdInput.trim() || !metaAppSecretInput.trim()) return
    setSavingMeta(true)
    try {
      const { data } = await api.put('/social/meta/settings', {
        metaAppId: metaAppIdInput.trim(),
        metaAppSecret: metaAppSecretInput.trim(),
      })
      setMetaSettings(data)
      setMetaAppIdInput('')
      setMetaAppSecretInput('')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao salvar o Meta App.')
    } finally {
      setSavingMeta(false)
    }
  }

  const handleRemoveMetaSettings = async () => {
    if (!confirm('Remover o Meta App? Você não vai conseguir conectar novas contas de Facebook/Instagram até reconfigurar.')) return
    try {
      const { data } = await api.delete('/social/meta/settings')
      setMetaSettings(data)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao remover o Meta App.')
    }
  }

  const handleConnectMeta = async () => {
    if (!socialClientId) return
    setConnectingMeta(true)
    try {
      const { data } = await api.get('/social/meta/connect', { params: { clientId: socialClientId } })
      window.location.href = data.authUrl
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao iniciar conexão com a Meta.')
      setConnectingMeta(false)
    }
  }

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!smtpForm.host.trim() || !smtpForm.username.trim() || !smtpForm.fromEmail.trim()) return
    if (!smtpSettings?.configured && !smtpForm.password.trim()) return
    setSavingSmtp(true)
    try {
      const { data } = await api.put('/email/settings', {
        host: smtpForm.host.trim(),
        port: Number(smtpForm.port) || 587,
        secure: smtpForm.secure,
        username: smtpForm.username.trim(),
        password: smtpForm.password.trim() || undefined,
        fromName: smtpForm.fromName.trim() || undefined,
        fromEmail: smtpForm.fromEmail.trim(),
      })
      setSmtpSettings(data)
      setSmtpForm((prev) => ({ ...prev, password: '' }))
      setSmtpTestResult(null)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao salvar as configurações de email.')
    } finally {
      setSavingSmtp(false)
    }
  }

  const handleTestSmtp = async () => {
    if (!smtpForm.host.trim() || !smtpForm.username.trim() || !smtpForm.password.trim()) return
    setTestingSmtp(true)
    setSmtpTestResult(null)
    try {
      const { data } = await api.post('/email/settings/test', {
        host: smtpForm.host.trim(),
        port: Number(smtpForm.port) || 587,
        secure: smtpForm.secure,
        username: smtpForm.username.trim(),
        password: smtpForm.password.trim(),
        fromEmail: smtpForm.fromEmail.trim() || smtpForm.username.trim(),
      })
      setSmtpTestResult({ success: true, message: data.message })
    } catch (err: any) {
      setSmtpTestResult({ success: false, message: err.response?.data?.error || 'Não foi possível conectar a esse servidor SMTP.' })
    } finally {
      setTestingSmtp(false)
    }
  }

  const handleRemoveSmtp = async () => {
    if (!confirm('Remover a configuração de email? Links de aprovação deixarão de ser enviados por email automaticamente.')) return
    try {
      const { data } = await api.delete('/email/settings')
      setSmtpSettings(data)
      setSmtpForm({ host: '', port: '587', secure: false, username: '', password: '', fromName: '', fromEmail: '' })
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao remover as configurações de email.')
    }
  }

  const handleConnectWhatsapp = async () => {
    if (!socialClientId) return
    setWaConnecting(true)
    setWaQr(null)
    setShowWaModal(true)
    try {
      const { data } = await api.post('/social/whatsapp/connect', { clientId: socialClientId })
      setWaQr(data.qrcode)
      setWaPolling(true)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao conectar WhatsApp.')
      setShowWaModal(false)
    } finally {
      setWaConnecting(false)
    }
  }

  // Poll connection status while the QR modal is open, waiting for the phone to pair.
  useEffect(() => {
    if (!waPolling || !socialClientId) return
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get('/social/whatsapp/status', { params: { clientId: socialClientId } })
        if (data.status === 'ACTIVE') {
          setWaPolling(false)
          setShowWaModal(false)
          loadConnections(socialClientId)
        }
      } catch {}
    }, 4000)
    return () => clearInterval(interval)
  }, [waPolling, socialClientId])

  const handleDeleteConnection = async (connId: string) => {
    if (!confirm('Desconectar esta conta?')) return
    try {
      await api.delete(`/social/connections/${connId}`)
      setConnections(connections.filter((c) => c.id !== connId))
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao desconectar.')
    }
  }

  const handleTestAi = async () => {
    if (!apiKeyInput.trim()) return
    setTestingAi(true)
    setTestResult(null)
    try {
      const { data } = await api.post('/ai/settings/test', { apiKey: apiKeyInput.trim(), textModel })
      setTestResult({ success: true, message: `Conectado com sucesso ao modelo ${data.model}.` })
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.error || 'Não foi possível conectar com essa chave.' })
    } finally {
      setTestingAi(false)
    }
  }

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKeyInput.trim()) return
    setSavingAi(true)
    try {
      const { data } = await api.put('/ai/settings', { apiKey: apiKeyInput.trim(), textModel, imageModel })
      setAiSettings(data)
      setApiKeyInput('')
      setTestResult(null)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao salvar a integração de IA.')
    } finally {
      setSavingAi(false)
    }
  }

  const handleRemoveAi = async () => {
    if (!confirm('Remover a integração de IA? O sistema volta a usar o provedor padrão do servidor (ou respostas mock).')) return
    try {
      const { data } = await api.delete('/ai/settings')
      setAiSettings(data)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao remover a integração de IA.')
    }
  }

  const handleUploadAgencyLogo = async (file: File) => {
    try {
      const { publicUrl } = await uploadFile(file)
      const { data } = await api.patch('/agencies/current', { logoUrl: publicUrl })
      setAgency(data)
    } catch {
      alert('Erro ao enviar o logotipo da agência.')
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data } = await api.post('/agencies/current/members/invite', {
        email: inviteEmail,
        role: inviteRole,
      })
      setMembers([...members, data])
      setShowInviteModal(false)
      setInviteEmail('')
      alert('Membro adicionado com sucesso!')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao convidar membro.')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Deseja remover este membro da agência?')) return
    try {
      await api.delete(`/agencies/current/members/${memberId}`)
      setMembers(members.filter((m) => m.id !== memberId))
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao remover membro.')
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Configurações da Agência</h1>
        <p className="text-xs text-muted-foreground font-medium mt-1">
          Gerencie os dados da organização, membros da equipe e permissões de acesso.
        </p>
      </div>

      {/* Agency Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <UploadableAvatar
              src={agency?.logoUrl}
              rounded="rounded-2xl"
              className="w-12 h-12 bg-primary/10"
              fallback={<Building size={22} className="text-primary-dark" />}
              onUpload={handleUploadAgencyLogo}
            />
            <div>
              <CardTitle>{agency?.name}</CardTitle>
              <CardDescription>Slug: {agency?.slug} • Fuso: {agency?.timezone}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-muted rounded-xl border border-border">
              <span className="text-muted-foreground block mb-1 font-bold uppercase tracking-wider text-[11px]">País / Região:</span>
              <span className="text-foreground font-extrabold">{agency?.country || 'Brasil (BR)'}</span>
            </div>
            <div className="p-4 bg-muted rounded-xl border border-border">
              <span className="text-muted-foreground block mb-1 font-bold uppercase tracking-wider text-[11px]">Idioma Padrão:</span>
              <span className="text-foreground font-extrabold">{agency?.locale || 'Português (pt-BR)'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center font-bold">
              <Users size={22} />
            </div>
            <div>
              <CardTitle>Membros da Equipe</CardTitle>
              <CardDescription>Pessoas com acesso ao painel de controle</CardDescription>
            </div>
          </div>

          <Button size="sm" onClick={() => setShowInviteModal(true)}>
            <Plus size={14} />
            <span>Adicionar Membro</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 bg-muted/60 hover:bg-muted rounded-2xl border border-border transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback>{getInitials(member.user?.name || 'U')}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-foreground truncate">{member.user?.name}</p>
                  <p className="text-[11px] text-muted-foreground font-medium truncate">{member.user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Badge>{ROLE_LABELS[member.role] || member.role}</Badge>

                {member.role !== 'OWNER' && user?.role === 'OWNER' && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-1.5 text-muted-foreground hover:text-error rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* AI Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary-dark flex items-center justify-center font-bold">
              <Sparkles size={22} />
            </div>
            <div>
              <CardTitle>Integração de IA</CardTitle>
              <CardDescription>Conecte sua própria chave de API para gerar legendas, estratégias e propostas de imagem</CardDescription>
            </div>
          </div>
          {aiSettings?.configured ? (
            <Badge variant="success">Conectado</Badge>
          ) : (
            <Badge variant="default">Não configurado</Badge>
          )}
        </CardHeader>

        <CardContent>
          {aiSettings?.configured && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl border border-border">
              <div className="text-xs">
                <p className="font-bold text-foreground">Chave atual: <span className="font-mono">{aiSettings.apiKeyMasked}</span></p>
                <p className="text-muted-foreground mt-0.5">
                  Modelo de texto: {aiSettings.textModel} • Modelo de imagem: {aiSettings.imageModel}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-error hover:text-error hover:bg-error/10" onClick={handleRemoveAi}>
                <Trash2 size={14} />
                <span>Remover</span>
              </Button>
            </div>
          )}

          <form onSubmit={handleSaveAi} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="apiKey">{aiSettings?.configured ? 'Substituir chave de API' : 'Chave de API da OpenAI'}</Label>
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={apiKeyInput}
                onChange={(e) => { setApiKeyInput(e.target.value); setTestResult(null) }}
                endAdornment={
                  <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="text-muted-foreground hover:text-foreground p-1">
                    {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />
              <p className="text-[11px] text-muted-foreground font-medium mt-1.5">
                Sua chave fica criptografada no banco e é usada só para gerar conteúdo desta agência — o custo de uso vai direto para sua conta na OpenAI.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="textModel">Modelo de texto</Label>
                <Select value={textModel} onValueChange={setTextModel}>
                  <SelectTrigger id="textModel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEXT_MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="imageModel">Modelo de imagem</Label>
                <Select value={imageModel} onValueChange={setImageModel}>
                  <SelectTrigger id="imageModel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMAGE_MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${testResult.success ? 'bg-success/10 text-success-dark' : 'bg-error/10 text-error-dark'}`}>
                {testResult.success ? <CheckCircle2 size={15} className="shrink-0" /> : <XCircle size={15} className="shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            <CardFooter className="!pt-2 !mt-0 !border-t-0 justify-between">
              <Button type="button" variant="outline" size="sm" disabled={!apiKeyInput.trim() || testingAi} onClick={handleTestAi}>
                {testingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Testar Conexão</span>
              </Button>
              <Button type="submit" size="sm" disabled={!apiKeyInput.trim()} loading={savingAi}>
                {!savingAi && <span>Salvar Integração</span>}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>

      {/* Email (SMTP) — used to auto-send approval-request links to clients */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-info/10 text-info-dark flex items-center justify-center font-bold">
              <Mail size={22} />
            </div>
            <div>
              <CardTitle>Email (SMTP)</CardTitle>
              <CardDescription>Conecte seu servidor de email para enviar automaticamente os links de aprovação aos clientes</CardDescription>
            </div>
          </div>
          {smtpSettings?.configured ? (
            <Badge variant="success">Conectado</Badge>
          ) : (
            <Badge variant="default">Não configurado</Badge>
          )}
        </CardHeader>

        <CardContent>
          {smtpSettings?.configured && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl border border-border mb-4">
              <div className="text-xs">
                <p className="font-bold text-foreground">{smtpSettings.fromEmail}{smtpSettings.fromName ? ` (${smtpSettings.fromName})` : ''}</p>
                <p className="text-muted-foreground mt-0.5">
                  {smtpSettings.host}:{smtpSettings.port} • Usuário: {smtpSettings.username}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="text-error hover:text-error hover:bg-error/10" onClick={handleRemoveSmtp}>
                <Trash2 size={14} />
                <span>Remover</span>
              </Button>
            </div>
          )}

          <form onSubmit={handleSaveSmtp} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="smtpHost">Servidor SMTP *</Label>
                <Input
                  id="smtpHost"
                  placeholder="smtp.gmail.com"
                  value={smtpForm.host}
                  onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="smtpPort">Porta *</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  placeholder="587"
                  value={smtpForm.port}
                  onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtpUsername">Usuário *</Label>
                <Input
                  id="smtpUsername"
                  placeholder="seu@email.com"
                  value={smtpForm.username}
                  onChange={(e) => setSmtpForm({ ...smtpForm, username: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="smtpPassword">{smtpSettings?.configured ? 'Substituir senha' : 'Senha *'}</Label>
                <Input
                  id="smtpPassword"
                  type={showSmtpPassword ? 'text' : 'password'}
                  placeholder={smtpSettings?.configured ? smtpSettings.passwordMasked : '••••••••'}
                  value={smtpForm.password}
                  onChange={(e) => { setSmtpForm({ ...smtpForm, password: e.target.value }); setSmtpTestResult(null) }}
                  endAdornment={
                    <button type="button" onClick={() => setShowSmtpPassword(!showSmtpPassword)} className="text-muted-foreground hover:text-foreground p-1">
                      {showSmtpPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtpFromEmail">Email de Envio *</Label>
                <Input
                  id="smtpFromEmail"
                  type="email"
                  placeholder="contato@suaagencia.com"
                  value={smtpForm.fromEmail}
                  onChange={(e) => setSmtpForm({ ...smtpForm, fromEmail: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="smtpFromName">Nome de Exibição</Label>
                <Input
                  id="smtpFromName"
                  placeholder="Sua Agência"
                  value={smtpForm.fromName}
                  onChange={(e) => setSmtpForm({ ...smtpForm, fromName: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Switch checked={smtpForm.secure} onCheckedChange={(v) => setSmtpForm({ ...smtpForm, secure: v })} id="smtpSecure" />
              <Label htmlFor="smtpSecure" className="normal-case tracking-normal font-semibold text-foreground/80 !mb-0">
                Conexão segura (SSL/TLS na porta 465)
              </Label>
            </div>

            {smtpTestResult && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${smtpTestResult.success ? 'bg-success/10 text-success-dark' : 'bg-error/10 text-error-dark'}`}>
                {smtpTestResult.success ? <CheckCircle2 size={15} className="shrink-0" /> : <XCircle size={15} className="shrink-0" />}
                <span>{smtpTestResult.message}</span>
              </div>
            )}

            <CardFooter className="!pt-2 !mt-0 !border-t-0 justify-between">
              <Button
                type="button" variant="outline" size="sm"
                disabled={!smtpForm.host.trim() || !smtpForm.username.trim() || !smtpForm.password.trim() || testingSmtp}
                onClick={handleTestSmtp}
              >
                {testingSmtp ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                <span>Testar Conexão</span>
              </Button>
              <Button type="submit" size="sm" loading={savingSmtp}>
                {!savingSmtp && <span>Salvar Email</span>}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>

      {/* Social Connections */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center font-bold">
              <Share2 size={22} />
            </div>
            <div>
              <CardTitle>Redes Sociais</CardTitle>
              <CardDescription>Conecte as contas do cliente para enviar propostas e publicar conteúdo</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Meta App (bring-your-own) */}
          <div className="p-4 bg-muted rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Seu Meta App (Facebook + Instagram)</span>
              {metaSettings?.configured ? <Badge variant="success">Configurado</Badge> : <Badge variant="default">Não configurado</Badge>}
            </div>

            {metaSettings?.configured ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">App ID: <span className="font-mono font-bold text-foreground">{metaSettings.metaAppId}</span> • Secret: <span className="font-mono">{metaSettings.metaAppSecretMasked}</span></span>
                <Button type="button" variant="ghost" size="sm" className="text-error hover:text-error hover:bg-error/10" onClick={handleRemoveMetaSettings}>
                  <Trash2 size={13} />
                  <span>Remover</span>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSaveMetaSettings} className="space-y-3">
                <p className="text-[11px] text-muted-foreground font-medium">
                  Crie um app em <span className="font-mono">developers.facebook.com</span>, adicione o produto "Facebook Login for Business" e registre esta URI de redirecionamento: <span className="font-mono font-bold text-foreground/80">…/api/v1/social/meta/callback</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input placeholder="App ID" value={metaAppIdInput} onChange={(e) => setMetaAppIdInput(e.target.value)} />
                  <Input
                    type={showMetaSecret ? 'text' : 'password'}
                    placeholder="App Secret"
                    value={metaAppSecretInput}
                    onChange={(e) => setMetaAppSecretInput(e.target.value)}
                    endAdornment={
                      <button type="button" onClick={() => setShowMetaSecret(!showMetaSecret)} className="text-muted-foreground hover:text-foreground p-1">
                        {showMetaSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    }
                  />
                </div>
                <Button type="submit" size="sm" disabled={!metaAppIdInput.trim() || !metaAppSecretInput.trim()} loading={savingMeta}>
                  {!savingMeta && <span>Salvar Meta App</span>}
                </Button>
              </form>
            )}
          </div>

          {clients.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Cadastre um cliente primeiro para conectar as redes sociais dele.</p>
          ) : (
            <>
              <div>
                <Label htmlFor="socialClient">Cliente</Label>
                <Select value={socialClientId} onValueChange={setSocialClientId}>
                  <SelectTrigger id="socialClient"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button type="button" variant="outline" onClick={handleConnectMeta} loading={connectingMeta} disabled={!metaSettings?.configured} className="justify-center gap-1.5">
                  {!connectingMeta && (
                    <>
                      <Facebook size={14} className="text-[#1877F2]" />
                      <span>Conectar Facebook</span>
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={handleConnectMeta} loading={connectingMeta} disabled={!metaSettings?.configured} className="justify-center gap-1.5">
                  {!connectingMeta && (
                    <>
                      <Instagram size={14} className="text-[#E4405F]" />
                      <span>Conectar Instagram</span>
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={handleConnectWhatsapp} className="justify-center gap-1.5">
                  <MessageCircle size={14} className="text-[#25D366]" />
                  <span>Conectar WhatsApp</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">
                {!metaSettings?.configured && 'Configure seu Meta App acima para liberar a conexão de Facebook e Instagram. '}
                Facebook e Instagram usam o mesmo login da Meta (a página precisa ter uma conta do Instagram profissional vinculada). O WhatsApp conecta via QR Code (Evolution API).
              </p>

              <div className="space-y-2 pt-2 border-t border-border">
                {loadingConnections ? (
                  <Skeleton className="h-14 w-full rounded-xl" />
                ) : connections.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhuma conta conectada para este cliente ainda.</p>
                ) : (
                  connections.map((conn) => (
                    <div key={conn.id} className="flex items-center justify-between p-3.5 bg-muted rounded-xl border border-border">
                      <div className="flex items-center gap-3">
                        {conn.platform === 'FACEBOOK' && <Facebook size={16} className="text-[#1877F2]" />}
                        {conn.platform === 'INSTAGRAM' && <Instagram size={16} className="text-[#E4405F]" />}
                        {conn.platform === 'WHATSAPP' && <MessageCircle size={16} className="text-[#25D366]" />}
                        <div>
                          <p className="text-xs font-bold text-foreground">{conn.accountName || conn.platform}</p>
                          <Badge variant={conn.status === 'ACTIVE' ? 'success' : 'warning'} className="mt-0.5">
                            {conn.status === 'ACTIVE' ? 'Conectado' : conn.status === 'PENDING' ? 'Aguardando' : 'Desconectado'}
                          </Badge>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteConnection(conn.id)}
                        className="p-1.5 text-muted-foreground hover:text-error rounded-lg transition-colors"
                      >
                        <Unplug size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp QR Modal */}
      <Dialog open={showWaModal} onOpenChange={setShowWaModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
                <QrCode size={20} />
              </div>
              <div>
                <DialogTitle>Conectar WhatsApp</DialogTitle>
                <DialogDescription>Escaneie com o WhatsApp do celular do cliente (Aparelhos Conectados)</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex items-center justify-center py-4">
            {waConnecting ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : waQr ? (
              <img src={waQr.startsWith('data:') ? waQr : `data:image/png;base64,${waQr}`} alt="QR Code WhatsApp" className="w-56 h-56 rounded-xl border border-border" />
            ) : (
              <p className="text-xs text-muted-foreground">Não foi possível gerar o QR Code.</p>
            )}
          </div>

          {waPolling && (
            <p className="text-[11px] text-center text-muted-foreground font-medium flex items-center justify-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Aguardando conexão...
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Invite Member Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Membro para Agência</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <Label htmlFor="inviteEmail">Email do Usuário *</Label>
              <Input
                id="inviteEmail"
                type="email"
                required
                placeholder="gerente@agencyflow.demo"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="inviteRole">Cargo / Permissão *</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="inviteRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="MANAGER">Gestor de Contas</SelectItem>
                  <SelectItem value="DESIGNER">Designer</SelectItem>
                  <SelectItem value="COPYWRITER">Copywriter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowInviteModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Membro</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
