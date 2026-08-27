import React, { useEffect, useState } from 'react'
import {
  Trash2, Eye, EyeOff, Loader2, CheckCircle2, XCircle,
  Share2, Facebook, Instagram, MessageCircle, QrCode, Unplug, Copy, Check, Mail, Building2, Contact,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Switch } from '@/components/ui/Switch'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/Card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/Dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/Select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'

// Built from wherever the app is actually running (works for localhost, staging, prod,
// Coolify's auto-generated domain, a custom domain — no manual "figure out your API URL" step).
const META_CALLBACK_URL = `${window.location.origin}/api/v1/social/meta/callback`

export function SocialConnectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)

  const [clients, setClients] = useState<any[]>([])
  const [socialClientId, setSocialClientId] = useState('')
  const [connections, setConnections] = useState<any[]>([])
  const [loadingConnections, setLoadingConnections] = useState(false)
  const [connectingMeta, setConnectingMeta] = useState(false)

  // WhatsApp (agency-level — one connection for the whole agency, used to send creative
  // previews to every client's phone for approval; clients never connect their own WhatsApp)
  const [waSettings, setWaSettings] = useState<any>(null)
  const [showWaModal, setShowWaModal] = useState(false)
  const [waQr, setWaQr] = useState<string | null>(null)
  const [waConnecting, setWaConnecting] = useState(false)
  const [waPolling, setWaPolling] = useState(false)

  // Page picker — shown when the agency's Facebook user has access to more than one Page
  // (e.g. Business Manager Partner Access to several clients at once) and we can't tell which
  // one belongs to the client being connected without asking.
  const [pagePickerToken, setPagePickerToken] = useState<string | null>(null)
  const [pagePickerClientId, setPagePickerClientId] = useState<string | null>(null)
  const [pendingPages, setPendingPages] = useState<Array<{ id: string; name: string; hasInstagram: boolean }>>([])
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([])
  const [loadingPendingPages, setLoadingPendingPages] = useState(false)
  const [confirmingPageSelection, setConfirmingPageSelection] = useState(false)

  // Meta App (bring-your-own) settings
  const [metaSettings, setMetaSettings] = useState<any>(null)
  const [showMetaModal, setShowMetaModal] = useState(false)
  const [metaAppIdInput, setMetaAppIdInput] = useState('')
  const [metaAppSecretInput, setMetaAppSecretInput] = useState('')
  const [showMetaSecret, setShowMetaSecret] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [copiedCallback, setCopiedCallback] = useState(false)

  // SMTP (bring-your-own email, for approval-request notifications)
  const [smtpSettings, setSmtpSettings] = useState<any>(null)
  const [showSmtpModal, setShowSmtpModal] = useState(false)
  const [smtpForm, setSmtpForm] = useState({ host: '', port: '587', secure: false, username: '', password: '', fromName: '', fromEmail: '' })
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [cliRes, metaRes, waRes, smtpRes] = await Promise.all([
          api.get('/clients'),
          api.get('/social/meta/settings'),
          api.get('/social/whatsapp/settings'),
          api.get('/email/settings'),
        ])
        setClients(cliRes.data.data || [])
        if (cliRes.data.data?.length > 0) setSocialClientId(cliRes.data.data[0].id)
        setMetaSettings(metaRes.data)
        setWaSettings(waRes.data)
        setSmtpSettings(smtpRes.data)
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
    } else if (searchParams.get('social_select_page')) {
      const token = searchParams.get('token')
      const cid = searchParams.get('clientId')
      if (cid) setSocialClientId(cid)
      if (token) loadPendingPages(token)
      setSearchParams({}, { replace: true })
    } else if (searchParams.get('social_error')) {
      alert('Não foi possível conectar a conta. Tente novamente.')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  const loadPendingPages = async (token: string) => {
    setLoadingPendingPages(true)
    try {
      const { data } = await api.get(`/social/meta/pending/${token}`)
      setPendingPages(data.pages || [])
      setSelectedPageIds([])
      setPagePickerClientId(data.clientId)
      setPagePickerToken(token)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Não foi possível carregar as páginas encontradas. Tente conectar novamente.')
    } finally {
      setLoadingPendingPages(false)
    }
  }

  const togglePageSelection = (pageId: string) => {
    setSelectedPageIds((prev) => prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId])
  }

  const handleConfirmPageSelection = async () => {
    if (!pagePickerToken || selectedPageIds.length === 0) return
    setConfirmingPageSelection(true)
    try {
      await api.post(`/social/meta/pending/${pagePickerToken}/confirm`, { pageIds: selectedPageIds })
      setPagePickerToken(null)
      alert('Página(s) conectada(s) com sucesso!')
      if (pagePickerClientId) loadConnections(pagePickerClientId)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao confirmar a seleção.')
    } finally {
      setConfirmingPageSelection(false)
    }
  }

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

  const openMetaModal = () => {
    setMetaAppIdInput('')
    setMetaAppSecretInput('')
    setShowMetaModal(true)
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
      setShowMetaModal(false)
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

  const handleCopyCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(META_CALLBACK_URL)
      setCopiedCallback(true)
      setTimeout(() => setCopiedCallback(false), 2000)
    } catch {}
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

  const handleConnectWhatsapp = async () => {
    setWaConnecting(true)
    setWaQr(null)
    setShowWaModal(true)
    try {
      const { data } = await api.post('/social/whatsapp/connect')
      setWaQr(data.qrcode)
      setWaPolling(true)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao conectar WhatsApp.')
      setShowWaModal(false)
    } finally {
      setWaConnecting(false)
    }
  }

  const handleDisconnectWhatsapp = async () => {
    if (!confirm('Desconectar o WhatsApp da agência? As aprovações deixarão de ser enviadas por WhatsApp até reconectar.')) return
    try {
      await api.post('/social/whatsapp/disconnect')
      setWaSettings({ configured: false, status: 'DISCONNECTED' })
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao desconectar WhatsApp.')
    }
  }

  // Poll connection status while the QR modal is open, waiting for the phone to pair.
  useEffect(() => {
    if (!waPolling) return
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get('/social/whatsapp/status')
        if (data.status === 'ACTIVE') {
          setWaPolling(false)
          setShowWaModal(false)
          setWaSettings({ configured: true, status: 'ACTIVE', connectedNumber: data.connectedNumber })
        }
      } catch {}
    }, 4000)
    return () => clearInterval(interval)
  }, [waPolling])

  const handleDeleteConnection = async (connId: string) => {
    if (!confirm('Desconectar esta conta?')) return
    try {
      await api.delete(`/social/connections/${connId}`)
      setConnections(connections.filter((c) => c.id !== connId))
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao desconectar.')
    }
  }

  const openSmtpModal = () => {
    setSmtpForm(smtpSettings?.configured
      ? { host: smtpSettings.host || '', port: String(smtpSettings.port || '587'), secure: !!smtpSettings.secure, username: smtpSettings.username || '', password: '', fromName: smtpSettings.fromName || '', fromEmail: smtpSettings.fromEmail || '' }
      : { host: '', port: '587', secure: false, username: '', password: '', fromName: '', fromEmail: '' })
    setSmtpTestResult(null)
    setShowSmtpModal(true)
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
      setSmtpTestResult(null)
      setShowSmtpModal(false)
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
    if (!confirm('Remover a configuração de email? Links de aprovação deixarão de ser enviados por email.')) return
    try {
      const { data } = await api.delete('/email/settings')
      setSmtpSettings(data)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao remover as configurações de email.')
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8 space-y-8">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Redes Sociais</h1>
        <p className="text-xs text-muted-foreground font-medium mt-1">
          Conecte o Facebook/Instagram de cada cliente e o WhatsApp/Email da agência para publicar conteúdo e enviar aprovações.
        </p>
      </div>

      <Tabs defaultValue="agencia">
        <TabsList>
          <TabsTrigger value="agencia" className="inline-flex items-center gap-1.5"><Building2 size={14} />Agência</TabsTrigger>
          <TabsTrigger value="cliente" className="inline-flex items-center gap-1.5"><Contact size={14} />Cliente</TabsTrigger>
        </TabsList>

        {/* ─── AGÊNCIA: contas/credenciais únicas, compartilhadas por toda a agência ─── */}
        <TabsContent value="agencia">
          <Card>
            <CardHeader>
              <CardTitle>Contas da Agência</CardTitle>
              <CardDescription>Credenciais únicas, compartilhadas por toda a agência — configure cada uma uma vez</CardDescription>
            </CardHeader>

            <CardContent className="space-y-2.5">
              {/* Meta App row */}
              <div className="flex items-center justify-between gap-3 p-4 bg-muted/60 hover:bg-muted rounded-2xl border border-border transition-colors">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                    <Share2 size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-foreground truncate">Meta App (Facebook + Instagram)</p>
                    <p className="text-[11px] text-muted-foreground font-medium truncate">
                      {metaSettings?.configured ? `App ID: ${metaSettings.metaAppId}` : 'Necessário para conectar Facebook/Instagram de clientes'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {metaSettings?.configured ? <Badge variant="success">Configurado</Badge> : <Badge variant="default">Não configurado</Badge>}
                  <Button type="button" variant="outline" size="sm" onClick={openMetaModal}>
                    <span>{metaSettings?.configured ? 'Editar' : 'Configurar'}</span>
                  </Button>
                  {metaSettings?.configured && (
                    <button
                      onClick={handleRemoveMetaSettings}
                      className="p-1.5 text-muted-foreground hover:text-error rounded-lg transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* WhatsApp row */}
              <div className="flex items-center justify-between gap-3 p-4 bg-muted/60 hover:bg-muted rounded-2xl border border-border transition-colors">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0">
                    <MessageCircle size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-foreground truncate">WhatsApp (envio de aprovações)</p>
                    <p className="text-[11px] text-muted-foreground font-medium truncate">
                      {waSettings?.configured
                        ? (waSettings.connectedNumber ? `Número: ${waSettings.connectedNumber}` : 'Conectado')
                        : 'Um número envia aprovações para qualquer cliente'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {waSettings?.configured ? <Badge variant="success">Conectado</Badge> : <Badge variant="default">Não conectado</Badge>}
                  {waSettings?.configured ? (
                    <button
                      onClick={handleDisconnectWhatsapp}
                      className="p-1.5 text-muted-foreground hover:text-error rounded-lg transition-colors"
                      title="Desconectar"
                    >
                      <Unplug size={15} />
                    </button>
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={handleConnectWhatsapp}>
                      <span>Conectar</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Email (SMTP) row */}
              <div className="flex items-center justify-between gap-3 p-4 bg-muted/60 hover:bg-muted rounded-2xl border border-border transition-colors">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-info/10 text-info-dark flex items-center justify-center shrink-0">
                    <Mail size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-foreground truncate">Email (SMTP)</p>
                    <p className="text-[11px] text-muted-foreground font-medium truncate">
                      {smtpSettings?.configured ? smtpSettings.fromEmail : 'Um servidor envia links de aprovação por email'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {smtpSettings?.configured ? <Badge variant="success">Conectado</Badge> : <Badge variant="default">Não configurado</Badge>}
                  <Button type="button" variant="outline" size="sm" onClick={openSmtpModal}>
                    <span>{smtpSettings?.configured ? 'Editar' : 'Configurar'}</span>
                  </Button>
                  {smtpSettings?.configured && (
                    <button
                      onClick={handleRemoveSmtp}
                      className="p-1.5 text-muted-foreground hover:text-error rounded-lg transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── CLIENTE: conexões específicas de cada marca (Facebook/Instagram) ─── */}
        <TabsContent value="cliente">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center font-bold">
                  <Contact size={22} />
                </div>
                <div>
                  <CardTitle>Contas do Cliente</CardTitle>
                  <CardDescription>Facebook e Instagram são conectados individualmente, por cliente</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {clients.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Cadastre um cliente primeiro para conectar o Facebook/Instagram dele.</p>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {!metaSettings?.configured && 'Configure o Meta App da agência na aba Agência para liberar a conexão de Facebook e Instagram. '}
                    Facebook e Instagram usam o mesmo login da Meta (a página precisa ter uma conta do Instagram profissional vinculada).
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
        </TabsContent>
      </Tabs>

      {/* Meta App Modal */}
      <Dialog open={showMetaModal} onOpenChange={setShowMetaModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                <Share2 size={20} />
              </div>
              <div>
                <DialogTitle>{metaSettings?.configured ? 'Editar Meta App' : 'Configurar Meta App'}</DialogTitle>
                <DialogDescription>Facebook + Instagram — registrado uma vez, usado para conectar a conta de qualquer cliente</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {metaSettings?.configured && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border text-xs">
              <span className="text-muted-foreground">App ID: <span className="font-mono font-bold text-foreground">{metaSettings.metaAppId}</span> • Secret: <span className="font-mono">{metaSettings.metaAppSecretMasked}</span></span>
            </div>
          )}

          <form onSubmit={handleSaveMetaSettings} className="space-y-3" autoComplete="off">
            <p className="text-[11px] text-muted-foreground font-medium">
              Crie um app em <span className="font-mono">developers.facebook.com</span>, adicione o produto "Facebook Login for Business" e registre esta URI de redirecionamento:
            </p>
            <div className="flex items-center gap-2 p-2.5 bg-background rounded-lg border border-border">
              <span className="flex-1 min-w-0 truncate text-[11px] font-mono font-bold text-foreground/80">{META_CALLBACK_URL}</span>
              <button
                type="button"
                onClick={handleCopyCallbackUrl}
                className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Copiar URL"
              >
                {copiedCallback ? <Check size={13} className="text-success" /> : <Copy size={13} />}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="metaAppId">App ID</Label>
                <Input id="metaAppId" name="meta_app_id" autoComplete="off" placeholder="App ID" value={metaAppIdInput} onChange={(e) => setMetaAppIdInput(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="metaAppSecret">App Secret</Label>
                <Input
                  id="metaAppSecret"
                  name="meta_app_secret"
                  autoComplete="new-password"
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
            </div>
            <p className="text-[11px] text-muted-foreground font-medium italic">
              Não é o token de publicação — é só a credencial do seu app na Meta, usada pelo servidor para autenticar o login. O token que de fato autoriza postar em cada página é gerado automaticamente, por cliente, quando você clica em "Conectar Facebook" na aba Cliente.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowMetaModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={!metaAppIdInput.trim() || !metaAppSecretInput.trim()} loading={savingMeta}>
                {!savingMeta && <span>{metaSettings?.configured ? 'Substituir Meta App' : 'Salvar Meta App'}</span>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SMTP Modal */}
      <Dialog open={showSmtpModal} onOpenChange={setShowSmtpModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info/15 text-info-dark flex items-center justify-center shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <DialogTitle>{smtpSettings?.configured ? 'Editar Email (SMTP)' : 'Configurar Email (SMTP)'}</DialogTitle>
                <DialogDescription>Servidor único da agência — envia os links de aprovação por email a qualquer cliente</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveSmtp} className="space-y-4" autoComplete="off">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="smtpHost">Servidor SMTP *</Label>
                <Input id="smtpHost" name="smtp_host" autoComplete="off" placeholder="smtp.gmail.com" value={smtpForm.host} onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="smtpPort">Porta *</Label>
                <Input id="smtpPort" name="smtp_port" autoComplete="off" type="number" placeholder="587" value={smtpForm.port} onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtpUsername">Usuário *</Label>
                <Input id="smtpUsername" name="smtp_user" autoComplete="off" placeholder="seu@email.com" value={smtpForm.username} onChange={(e) => setSmtpForm({ ...smtpForm, username: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="smtpPassword">{smtpSettings?.configured ? 'Substituir senha' : 'Senha *'}</Label>
                <Input
                  id="smtpPassword"
                  name="smtp_pass"
                  autoComplete="new-password"
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
                <Input id="smtpFromEmail" name="smtp_from_email" autoComplete="off" type="email" placeholder="contato@suaagencia.com" value={smtpForm.fromEmail} onChange={(e) => setSmtpForm({ ...smtpForm, fromEmail: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="smtpFromName">Nome de Exibição</Label>
                <Input id="smtpFromName" name="smtp_from_name" autoComplete="off" placeholder="Sua Agência" value={smtpForm.fromName} onChange={(e) => setSmtpForm({ ...smtpForm, fromName: e.target.value })} />
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

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button" variant="outline" size="sm"
                disabled={!smtpForm.host.trim() || !smtpForm.username.trim() || !smtpForm.password.trim() || testingSmtp}
                onClick={handleTestSmtp}
              >
                {testingSmtp ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                <span>Testar Conexão</span>
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowSmtpModal(false)}>Cancelar</Button>
                <Button type="submit" loading={savingSmtp}>
                  {!savingSmtp && <span>Salvar Email</span>}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* WhatsApp QR Modal */}
      <Dialog open={showWaModal} onOpenChange={setShowWaModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
                <QrCode size={20} />
              </div>
              <div>
                <DialogTitle>Conectar WhatsApp da Agência</DialogTitle>
                <DialogDescription>Escaneie com o WhatsApp da agência no celular (Aparelhos Conectados)</DialogDescription>
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

      {/* Page Picker — the Facebook login returned more than one Page (common with Business
         Manager Partner Access covering several clients at once); pick which one(s) belong
         to this client before connecting anything. */}
      <Dialog open={!!pagePickerToken} onOpenChange={(open) => { if (!open) setPagePickerToken(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                <Facebook size={20} />
              </div>
              <div>
                <DialogTitle>Qual página é deste cliente?</DialogTitle>
                <DialogDescription>
                  {clients.find((c) => c.id === pagePickerClientId)?.name
                    ? `Sua conta do Facebook tem acesso a mais de uma página. Selecione a(s) que pertence(m) a ${clients.find((c) => c.id === pagePickerClientId)?.name}.`
                    : 'Sua conta do Facebook tem acesso a mais de uma página. Selecione a(s) que pertence(m) a este cliente.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {loadingPendingPages ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {pendingPages.map((page) => (
                <label key={page.id} className="flex items-center gap-3 p-3 bg-muted rounded-xl border border-border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPageIds.includes(page.id)}
                    onChange={() => togglePageSelection(page.id)}
                    className="rounded border-grey-300 text-primary focus:ring-primary shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate">{page.name}</p>
                    {page.hasInstagram && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Instagram size={11} className="text-[#E4405F]" /> Instagram vinculado
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setPagePickerToken(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmPageSelection} loading={confirmingPageSelection} disabled={selectedPageIds.length === 0}>
              {!confirmingPageSelection && <span>Conectar {selectedPageIds.length > 0 ? `(${selectedPageIds.length})` : ''}</span>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
