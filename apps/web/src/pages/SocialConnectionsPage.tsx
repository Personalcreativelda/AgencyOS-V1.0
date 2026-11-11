import React, { useEffect, useState } from 'react'
import {
  Trash2, Eye, EyeOff, Loader2, CheckCircle2, XCircle,
  QrCode, Unplug, Copy, Check, Mail, Building2, Contact,
  ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { SiFacebook, SiMeta, SiTiktok, SiWhatsapp, SiYoutube } from 'react-icons/si'
import { FaLinkedin } from 'react-icons/fa6'
import { BrandIcon } from '@/components/brand/BrandIcon'
import api from '@/lib/api'
import { cn, PLATFORM_COLORS } from '@/lib/utils'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogIcon } from '@/components/ui/Dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/Select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'
import { Page, PageHeader } from '@/components/layout/Page'

// Built from wherever the app is actually running (works for localhost, staging, prod,
// Coolify's auto-generated domain, a custom domain — no manual "figure out your API URL" step).
const META_CALLBACK_URL = `${window.location.origin}/api/v1/social/meta/callback`
const LINKEDIN_CALLBACK_URL = `${window.location.origin}/api/v1/social/linkedin/callback`
const TIKTOK_CALLBACK_URL = `${window.location.origin}/api/v1/social/tiktok/callback`
const YOUTUBE_CALLBACK_URL = `${window.location.origin}/api/v1/social/youtube/callback`

// Guided setup for a first-time Meta App — every step here comes from an actual snag hit while
// building this integration (rate-limited app creation, "Invalid Scopes" from a missing
// Instagram product, the redirect URI being pasted into the wrong field...). The last step
// (index 4, 1-based step 5) is followed by the real form (see META_WIZARD_STEPS.length + 1).
const META_WIZARD_STEPS: { title: string; items: string[] }[] = [
  {
    title: 'Criar o App na Meta',
    items: [
      'Acesse developers.facebook.com/apps e clique em "Criar App".',
      'Escolha o tipo "Empresa" (ou o mais próximo disso).',
      'Dê um nome que NÃO contenha a palavra "teste" — a Meta costuma bloquear nomes assim como spam.',
      'Se aparecer o erro "Essa ação não é permitida", espere alguns minutos e tente de novo — é limite temporário da Meta, não é nada errado que você fez.',
    ],
  },
  {
    title: 'Adicionar os produtos certos',
    items: [
      'No painel do app, clique em "Adicionar Produto".',
      'Adicione "Login do Facebook" e configure como "Empresa" (não "Consumidor").',
      'Adicione também o produto "Instagram" — sem ele, a conexão falha com o erro "Invalid Scopes", mesmo com o Login do Facebook certo.',
    ],
  },
  {
    title: 'Registrar a URL de redirecionamento',
    items: [
      'Vá em Login do Facebook → Configurações.',
      'Cole a URL abaixo no campo "URIs de redirecionamento do OAuth válidos" — não no campo de verificação lá em cima, que é só um teste e não salva nada.',
      'Role até o final da página e clique em "Salvar Alterações". Esse passo é fácil de esquecer.',
    ],
  },
  {
    title: 'Adicionar você como testador',
    items: [
      'Vá em Funções do App → Funções.',
      'Adicione o usuário que vai conectar as páginas (você) com papel de Admin, Developer ou Tester.',
      'Enquanto o app não passa pela revisão da Meta (App Review), só quem tem um desses papéis consegue fazer login e conectar páginas.',
    ],
  },
  {
    title: 'Copiar as credenciais',
    items: [
      'Vá em Configurações → Básico.',
      'Copie o "ID do Aplicativo" e a "Chave Secreta do Aplicativo" (pode precisar confirmar sua senha pra ver a chave).',
      'Cole os dois no próximo passo.',
    ],
  },
]

// Guided setup for a first-time LinkedIn App — mirrors META_WIZARD_STEPS. The LinkedIn-specific
// snag is step 2: posting to a Company Page needs the "Community Management API" product,
// which requires LinkedIn's own approval (can take a few days) — flagged explicitly so it
// isn't mistaken for something broken in the app.
const LINKEDIN_WIZARD_STEPS: { title: string; items: string[] }[] = [
  {
    title: 'Criar o App no LinkedIn',
    items: [
      'Acesse linkedin.com/developers/apps e clique em "Create app".',
      'Vincule o app à Página de Empresa da sua agência (ela precisa já existir no LinkedIn).',
    ],
  },
  {
    title: 'Solicitar acesso à Community Management API',
    items: [
      'Na aba "Products" do app, adicione o produto "Community Management API".',
      'O LinkedIn precisa aprovar esse acesso antes de liberar a permissão de postar em Páginas de Empresa — isso pode levar alguns dias. Enquanto não for aprovado, a conexão vai falhar com erro de permissão, o que é esperado.',
    ],
  },
  {
    title: 'Registrar a URL de redirecionamento',
    items: [
      'Vá na aba "Auth".',
      'Cole a URL abaixo em "Authorized redirect URLs for your app".',
    ],
  },
  {
    title: 'Copiar as credenciais',
    items: [
      'Ainda na aba "Auth", copie o "Client ID" e o "Client Secret".',
      'Cole os dois no próximo passo.',
    ],
  },
]

// Guided setup for a first-time TikTok App — mirrors LINKEDIN_WIZARD_STEPS. The TikTok-specific
// snag (step 2) is stricter than LinkedIn's: until the app passes TikTok's own audit for the
// Content Posting API, EVERY post published through it is forced into private/self-only
// viewing — not a broken connection, just TikTok's own restriction on unaudited apps.
const TIKTOK_WIZARD_STEPS: { title: string; items: string[] }[] = [
  {
    title: 'Criar o App no TikTok',
    items: [
      'Acesse developers.tiktok.com/apps e clique em "Create an app" (ou "Manage apps").',
    ],
  },
  {
    title: 'Adicionar o produto Content Posting API',
    items: [
      'Na aba de produtos do app, adicione "Content Posting API" e solicite a permissão video.publish.',
      'Até o TikTok aprovar a auditoria (pode levar alguns dias), os posts feitos por aqui ficam visíveis só para a própria conta — isso é uma restrição do TikTok, não um erro do sistema.',
    ],
  },
  {
    title: 'Registrar a URL de redirecionamento',
    items: [
      'Na aba "Login Kit" (ou "Auth"), cole a URL abaixo em "Redirect URI".',
    ],
  },
  {
    title: 'Copiar as credenciais',
    items: [
      'Copie a "Client Key" e a "Client Secret".',
      'Cole os dois no próximo passo.',
    ],
  },
]

// Guided setup for a first-time YouTube (Google Cloud) App — mirrors TIKTOK_WIZARD_STEPS. The
// Google-specific snag (step 2) is different in kind from TikTok's: it's not about what gets
// posted, it's about WHO can authorize the app and for how long — apps not verified by Google
// only let up to 100 manually-added "test users" connect, and their connection expires every 7
// days until verification is done.
const YOUTUBE_WIZARD_STEPS: { title: string; items: string[] }[] = [
  {
    title: 'Criar o projeto no Google Cloud',
    items: [
      'Acesse console.cloud.google.com, crie um projeto e ative a "YouTube Data API v3" (em APIs e Serviços → Biblioteca).',
    ],
  },
  {
    title: 'Configurar a tela de consentimento OAuth',
    items: [
      'Em APIs e Serviços → Tela de consentimento OAuth, adicione uma política de privacidade (pode ser uma página simples no seu domínio).',
      'Enquanto o projeto não passar pela verificação do Google (necessária pro escopo de upload do YouTube), só até 100 contas Google cadastradas manualmente como "testadoras" conseguem conectar, e a conexão expira a cada 7 dias — normal para testes, mas exige reconectar toda semana até a verificação ser aprovada.',
    ],
  },
  {
    title: 'Criar credenciais OAuth e registrar a URL',
    items: [
      'Em APIs e Serviços → Credenciais, crie uma credencial OAuth do tipo "Aplicativo Web".',
      'Cole a URL abaixo em "URIs de redirecionamento autorizados".',
    ],
  },
  {
    title: 'Copiar as credenciais',
    items: [
      'Copie o "ID do cliente" e a "Chave secreta do cliente".',
      'Cole os dois no próximo passo.',
    ],
  },
]

const PLATFORM_NAMES: Record<string, string> = {
  FACEBOOK: 'Página do Facebook',
  INSTAGRAM: 'Instagram profissional',
  LINKEDIN: 'Página do LinkedIn',
  TIKTOK: 'TikTok',
  YOUTUBE: 'Canal do YouTube',
  WHATSAPP: 'WhatsApp Status',
}

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
  const [metaWizardStep, setMetaWizardStep] = useState(1) // guided setup — the last step is the actual form
  const [metaAppIdInput, setMetaAppIdInput] = useState('')
  const [metaAppSecretInput, setMetaAppSecretInput] = useState('')
  const [showMetaSecret, setShowMetaSecret] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [copiedCallback, setCopiedCallback] = useState(false)

  // LinkedIn App (bring-your-own) settings + connect flow — mirrors the Meta block above
  const [linkedinSettings, setLinkedinSettings] = useState<any>(null)
  const [showLinkedinModal, setShowLinkedinModal] = useState(false)
  const [linkedinWizardStep, setLinkedinWizardStep] = useState(1)
  const [linkedinClientIdInput, setLinkedinClientIdInput] = useState('')
  const [linkedinClientSecretInput, setLinkedinClientSecretInput] = useState('')
  const [showLinkedinSecret, setShowLinkedinSecret] = useState(false)
  const [savingLinkedin, setSavingLinkedin] = useState(false)
  const [copiedLinkedinCallback, setCopiedLinkedinCallback] = useState(false)
  const [connectingLinkedin, setConnectingLinkedin] = useState(false)

  // Organization picker — shown when the LinkedIn member administers more than one Company
  // Page and we can't tell which one belongs to the client being connected without asking.
  const [orgPickerToken, setOrgPickerToken] = useState<string | null>(null)
  const [orgPickerClientId, setOrgPickerClientId] = useState<string | null>(null)
  const [pendingOrgs, setPendingOrgs] = useState<Array<{ urn: string; name: string }>>([])
  const [selectedOrgUrns, setSelectedOrgUrns] = useState<string[]>([])
  const [loadingPendingOrgs, setLoadingPendingOrgs] = useState(false)
  const [confirmingOrgSelection, setConfirmingOrgSelection] = useState(false)

  // TikTok App (bring-your-own) settings + connect flow — no account picker needed (TikTok
  // OAuth connects exactly one account per authorization, unlike Meta Pages/LinkedIn Orgs).
  const [tiktokSettings, setTiktokSettings] = useState<any>(null)
  const [showTiktokModal, setShowTiktokModal] = useState(false)
  const [tiktokWizardStep, setTiktokWizardStep] = useState(1)
  const [tiktokClientKeyInput, setTiktokClientKeyInput] = useState('')
  const [tiktokClientSecretInput, setTiktokClientSecretInput] = useState('')
  const [showTiktokSecret, setShowTiktokSecret] = useState(false)
  const [savingTiktok, setSavingTiktok] = useState(false)
  const [copiedTiktokCallback, setCopiedTiktokCallback] = useState(false)
  const [connectingTiktok, setConnectingTiktok] = useState(false)

  // YouTube App (bring-your-own Google Cloud project) settings + connect flow — no channel
  // picker (same reasoning as TikTok: one account per authorization).
  const [youtubeSettings, setYoutubeSettings] = useState<any>(null)
  const [showYoutubeModal, setShowYoutubeModal] = useState(false)
  const [youtubeWizardStep, setYoutubeWizardStep] = useState(1)
  const [youtubeClientIdInput, setYoutubeClientIdInput] = useState('')
  const [youtubeClientSecretInput, setYoutubeClientSecretInput] = useState('')
  const [showYoutubeSecret, setShowYoutubeSecret] = useState(false)
  const [savingYoutube, setSavingYoutube] = useState(false)
  const [copiedYoutubeCallback, setCopiedYoutubeCallback] = useState(false)
  const [connectingYoutube, setConnectingYoutube] = useState(false)

  // WhatsApp Status (per-client, Evolution API) — no OAuth, no agency-level settings needed:
  // just the client's already-paired Evolution instance name, reusing the agency's own
  // Evolution API server (EVOLUTION_API_URL/KEY) that already works for the agency-level
  // WhatsApp connection below.
  const [showWhatsappConnectModal, setShowWhatsappConnectModal] = useState(false)
  const [whatsappInstanceInput, setWhatsappInstanceInput] = useState('')
  const [connectingClientWhatsapp, setConnectingClientWhatsapp] = useState(false)

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
        const [cliRes, metaRes, linkedinRes, tiktokRes, youtubeRes, waRes, smtpRes] = await Promise.all([
          api.get('/clients'),
          api.get('/social/meta/settings'),
          api.get('/social/linkedin/settings'),
          api.get('/social/tiktok/settings'),
          api.get('/social/youtube/settings'),
          api.get('/social/whatsapp/settings'),
          api.get('/email/settings'),
        ])
        setClients(cliRes.data.data || [])
        if (cliRes.data.data?.length > 0) setSocialClientId(cliRes.data.data[0].id)
        setMetaSettings(metaRes.data)
        setLinkedinSettings(linkedinRes.data)
        setTiktokSettings(tiktokRes.data)
        setYoutubeSettings(youtubeRes.data)
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
      toast.success('Conta conectada com sucesso!')
      setSearchParams({}, { replace: true })
    } else if (searchParams.get('social_select_page')) {
      const token = searchParams.get('token')
      const cid = searchParams.get('clientId')
      if (cid) setSocialClientId(cid)
      if (token) loadPendingPages(token)
      setSearchParams({}, { replace: true })
    } else if (searchParams.get('social_select_org')) {
      const token = searchParams.get('token')
      const cid = searchParams.get('clientId')
      if (cid) setSocialClientId(cid)
      if (token) loadPendingOrgs(token)
      setSearchParams({}, { replace: true })
    } else if (searchParams.get('social_error')) {
      toast.error('Não foi possível conectar a conta', 'Tente novamente.')
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
      toast.error('Não foi possível carregar as páginas', getErrorMessage(err, 'Tente conectar novamente.'))
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
      toast.success('Página(s) conectada(s) com sucesso!')
      if (pagePickerClientId) loadConnections(pagePickerClientId)
    } catch (err: any) {
      toast.error('Erro ao confirmar a seleção', getErrorMessage(err))
    } finally {
      setConfirmingPageSelection(false)
    }
  }

  const loadPendingOrgs = async (token: string) => {
    setLoadingPendingOrgs(true)
    try {
      const { data } = await api.get(`/social/linkedin/pending/${token}`)
      setPendingOrgs(data.orgs || [])
      setSelectedOrgUrns([])
      setOrgPickerClientId(data.clientId)
      setOrgPickerToken(token)
    } catch (err: any) {
      toast.error('Não foi possível carregar as organizações', getErrorMessage(err, 'Tente conectar novamente.'))
    } finally {
      setLoadingPendingOrgs(false)
    }
  }

  const toggleOrgSelection = (urn: string) => {
    setSelectedOrgUrns((prev) => prev.includes(urn) ? prev.filter((u) => u !== urn) : [...prev, urn])
  }

  const handleConfirmOrgSelection = async () => {
    if (!orgPickerToken || selectedOrgUrns.length === 0) return
    setConfirmingOrgSelection(true)
    try {
      await api.post(`/social/linkedin/pending/${orgPickerToken}/confirm`, { orgUrns: selectedOrgUrns })
      setOrgPickerToken(null)
      toast.success('Organização(ões) conectada(s) com sucesso!')
      if (orgPickerClientId) loadConnections(orgPickerClientId)
    } catch (err: any) {
      toast.error('Erro ao confirmar a seleção', getErrorMessage(err))
    } finally {
      setConfirmingOrgSelection(false)
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
    // Already configured once? Skip straight to the form — the guide is for first-timers.
    setMetaWizardStep(metaSettings?.configured ? META_WIZARD_STEPS.length + 1 : 1)
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
      toast.error('Erro ao salvar o Meta App', getErrorMessage(err))
    } finally {
      setSavingMeta(false)
    }
  }

  const handleRemoveMetaSettings = async () => {
    const ok = await confirmDialog({
      title: 'Remover o Meta App?',
      description: 'Você não vai conseguir conectar novas contas de Facebook/Instagram até reconfigurar.',
      variant: 'destructive',
      confirmLabel: 'Remover',
    })
    if (!ok) return
    try {
      const { data } = await api.delete('/social/meta/settings')
      setMetaSettings(data)
    } catch (err: any) {
      toast.error('Erro ao remover o Meta App', getErrorMessage(err))
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
      toast.error('Erro ao iniciar conexão com a Meta', getErrorMessage(err))
      setConnectingMeta(false)
    }
  }

  const openLinkedinModal = () => {
    setLinkedinClientIdInput('')
    setLinkedinClientSecretInput('')
    setLinkedinWizardStep(linkedinSettings?.configured ? LINKEDIN_WIZARD_STEPS.length + 1 : 1)
    setShowLinkedinModal(true)
  }

  const handleSaveLinkedinSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkedinClientIdInput.trim() || !linkedinClientSecretInput.trim()) return
    setSavingLinkedin(true)
    try {
      const { data } = await api.put('/social/linkedin/settings', {
        linkedinClientId: linkedinClientIdInput.trim(),
        linkedinClientSecret: linkedinClientSecretInput.trim(),
      })
      setLinkedinSettings(data)
      setLinkedinClientIdInput('')
      setLinkedinClientSecretInput('')
      setShowLinkedinModal(false)
    } catch (err: any) {
      toast.error('Erro ao salvar o LinkedIn App', getErrorMessage(err))
    } finally {
      setSavingLinkedin(false)
    }
  }

  const handleRemoveLinkedinSettings = async () => {
    const ok = await confirmDialog({
      title: 'Remover o LinkedIn App?',
      description: 'Você não vai conseguir conectar novas Páginas de Empresa até reconfigurar.',
      variant: 'destructive',
      confirmLabel: 'Remover',
    })
    if (!ok) return
    try {
      const { data } = await api.delete('/social/linkedin/settings')
      setLinkedinSettings(data)
    } catch (err: any) {
      toast.error('Erro ao remover o LinkedIn App', getErrorMessage(err))
    }
  }

  const handleCopyLinkedinCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(LINKEDIN_CALLBACK_URL)
      setCopiedLinkedinCallback(true)
      setTimeout(() => setCopiedLinkedinCallback(false), 2000)
    } catch {}
  }

  const handleConnectLinkedin = async () => {
    if (!socialClientId) return
    setConnectingLinkedin(true)
    try {
      const { data } = await api.get('/social/linkedin/connect', { params: { clientId: socialClientId } })
      window.location.href = data.authUrl
    } catch (err: any) {
      toast.error('Erro ao iniciar conexão com o LinkedIn', getErrorMessage(err))
      setConnectingLinkedin(false)
    }
  }

  const openTiktokModal = () => {
    setTiktokClientKeyInput('')
    setTiktokClientSecretInput('')
    setTiktokWizardStep(tiktokSettings?.configured ? TIKTOK_WIZARD_STEPS.length + 1 : 1)
    setShowTiktokModal(true)
  }

  const handleSaveTiktokSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tiktokClientKeyInput.trim() || !tiktokClientSecretInput.trim()) return
    setSavingTiktok(true)
    try {
      const { data } = await api.put('/social/tiktok/settings', {
        tiktokClientKey: tiktokClientKeyInput.trim(),
        tiktokClientSecret: tiktokClientSecretInput.trim(),
      })
      setTiktokSettings(data)
      setTiktokClientKeyInput('')
      setTiktokClientSecretInput('')
      setShowTiktokModal(false)
    } catch (err: any) {
      toast.error('Erro ao salvar o TikTok App', getErrorMessage(err))
    } finally {
      setSavingTiktok(false)
    }
  }

  const handleRemoveTiktokSettings = async () => {
    const ok = await confirmDialog({
      title: 'Remover o TikTok App?',
      description: 'Você não vai conseguir conectar novas contas do TikTok até reconfigurar.',
      variant: 'destructive',
      confirmLabel: 'Remover',
    })
    if (!ok) return
    try {
      const { data } = await api.delete('/social/tiktok/settings')
      setTiktokSettings(data)
    } catch (err: any) {
      toast.error('Erro ao remover o TikTok App', getErrorMessage(err))
    }
  }

  const handleCopyTiktokCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(TIKTOK_CALLBACK_URL)
      setCopiedTiktokCallback(true)
      setTimeout(() => setCopiedTiktokCallback(false), 2000)
    } catch {}
  }

  const handleConnectTiktok = async () => {
    if (!socialClientId) return
    setConnectingTiktok(true)
    try {
      const { data } = await api.get('/social/tiktok/connect', { params: { clientId: socialClientId } })
      window.location.href = data.authUrl
    } catch (err: any) {
      toast.error('Erro ao iniciar conexão com o TikTok', getErrorMessage(err))
      setConnectingTiktok(false)
    }
  }

  const openYoutubeModal = () => {
    setYoutubeClientIdInput('')
    setYoutubeClientSecretInput('')
    setYoutubeWizardStep(youtubeSettings?.configured ? YOUTUBE_WIZARD_STEPS.length + 1 : 1)
    setShowYoutubeModal(true)
  }

  const handleSaveYoutubeSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!youtubeClientIdInput.trim() || !youtubeClientSecretInput.trim()) return
    setSavingYoutube(true)
    try {
      const { data } = await api.put('/social/youtube/settings', {
        youtubeClientId: youtubeClientIdInput.trim(),
        youtubeClientSecret: youtubeClientSecretInput.trim(),
      })
      setYoutubeSettings(data)
      setYoutubeClientIdInput('')
      setYoutubeClientSecretInput('')
      setShowYoutubeModal(false)
    } catch (err: any) {
      toast.error('Erro ao salvar o YouTube App', getErrorMessage(err))
    } finally {
      setSavingYoutube(false)
    }
  }

  const handleRemoveYoutubeSettings = async () => {
    const ok = await confirmDialog({
      title: 'Remover o YouTube App?',
      description: 'Você não vai conseguir conectar novos canais do YouTube até reconfigurar.',
      variant: 'destructive',
      confirmLabel: 'Remover',
    })
    if (!ok) return
    try {
      const { data } = await api.delete('/social/youtube/settings')
      setYoutubeSettings(data)
    } catch (err: any) {
      toast.error('Erro ao remover o YouTube App', getErrorMessage(err))
    }
  }

  const handleCopyYoutubeCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(YOUTUBE_CALLBACK_URL)
      setCopiedYoutubeCallback(true)
      setTimeout(() => setCopiedYoutubeCallback(false), 2000)
    } catch {}
  }

  const handleConnectYoutube = async () => {
    if (!socialClientId) return
    setConnectingYoutube(true)
    try {
      const { data } = await api.get('/social/youtube/connect', { params: { clientId: socialClientId } })
      window.location.href = data.authUrl
    } catch (err: any) {
      toast.error('Erro ao iniciar conexão com o YouTube', getErrorMessage(err))
      setConnectingYoutube(false)
    }
  }

  const openWhatsappConnectModal = () => {
    setWhatsappInstanceInput('')
    setShowWhatsappConnectModal(true)
  }

  const handleConnectClientWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!socialClientId || !whatsappInstanceInput.trim()) return
    setConnectingClientWhatsapp(true)
    try {
      await api.post('/social/connections/whatsapp', { clientId: socialClientId, instanceName: whatsappInstanceInput.trim() })
      setShowWhatsappConnectModal(false)
      toast.success('WhatsApp conectado com sucesso!')
      loadConnections(socialClientId)
    } catch (err: any) {
      toast.error('Erro ao conectar o WhatsApp', getErrorMessage(err))
    } finally {
      setConnectingClientWhatsapp(false)
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
      toast.error('Erro ao conectar WhatsApp', getErrorMessage(err))
      setShowWaModal(false)
    } finally {
      setWaConnecting(false)
    }
  }

  const handleDisconnectWhatsapp = async () => {
    const ok = await confirmDialog({
      title: 'Desconectar o WhatsApp da agência?',
      description: 'As aprovações deixarão de ser enviadas por WhatsApp até reconectar.',
      variant: 'destructive',
      confirmLabel: 'Desconectar',
    })
    if (!ok) return
    try {
      await api.post('/social/whatsapp/disconnect')
      setWaSettings({ configured: false, status: 'DISCONNECTED' })
    } catch (err: any) {
      toast.error('Erro ao desconectar WhatsApp', getErrorMessage(err))
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
    if (!(await confirmDialog({ title: 'Desconectar esta conta?', description: 'Publicações agendadas para esta conta deixam de ser enviadas até ela ser conectada de novo.', variant: 'destructive', confirmLabel: 'Desconectar' }))) return
    try {
      await api.delete(`/social/connections/${connId}`)
      setConnections(connections.filter((c) => c.id !== connId))
    } catch (err: any) {
      toast.error('Erro ao desconectar', getErrorMessage(err))
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
      toast.error('Erro ao salvar as configurações de email', getErrorMessage(err))
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
    const ok = await confirmDialog({
      title: 'Remover a configuração de email?',
      description: 'Links de aprovação deixarão de ser enviados por email.',
      variant: 'destructive',
      confirmLabel: 'Remover',
    })
    if (!ok) return
    try {
      const { data } = await api.delete('/email/settings')
      setSmtpSettings(data)
    } catch (err: any) {
      toast.error('Erro ao remover as configurações de email', getErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <Page>
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader
        title="Redes sociais"
        description="Conecte as redes de cada cliente e os canais da agência (WhatsApp e email) para publicar conteúdo e enviar aprovações."
      />

      <Tabs defaultValue="agencia">
        <TabsList>
          <TabsTrigger value="agencia" className="inline-flex items-center gap-1.5"><Building2 size={14} />Agência</TabsTrigger>
          <TabsTrigger value="cliente" className="inline-flex items-center gap-1.5"><Contact size={14} />Cliente</TabsTrigger>
        </TabsList>

        {/* ─── AGÊNCIA: contas/credenciais únicas, compartilhadas por toda a agência ─── */}
        <TabsContent value="agencia">
          <Card>
            <CardHeader className="mb-0">
              <div>
                <CardTitle>Contas da agência</CardTitle>
                <CardDescription>Credenciais únicas, compartilhadas por toda a agência — configure cada uma uma vez.</CardDescription>
              </div>
            </CardHeader>

            <CardContent className="-mx-5 -mb-5 space-y-0 divide-y divide-border">
              {/* Meta App row */}
              <div className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0467DF]/10 text-[#0467DF]">
                    <SiMeta size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">Meta App (Facebook + Instagram)</p>
                    <p className="truncate text-xs text-muted-foreground">
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

              {/* LinkedIn App row */}
              <div className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0A66C2]/10 text-[#0A66C2]">
                    <FaLinkedin size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">LinkedIn App</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {linkedinSettings?.configured ? `Client ID: ${linkedinSettings.linkedinClientId}` : 'Necessário para conectar Páginas de Empresa de clientes'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {linkedinSettings?.configured ? <Badge variant="success">Configurado</Badge> : <Badge variant="default">Não configurado</Badge>}
                  <Button type="button" variant="outline" size="sm" onClick={openLinkedinModal}>
                    <span>{linkedinSettings?.configured ? 'Editar' : 'Configurar'}</span>
                  </Button>
                  {linkedinSettings?.configured && (
                    <button
                      onClick={handleRemoveLinkedinSettings}
                      className="p-1.5 text-muted-foreground hover:text-error rounded-lg transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* TikTok App row */}
              <div className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[#fff]"
                    style={{ backgroundColor: PLATFORM_COLORS.TIKTOK }}
                  >
                    <SiTiktok size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">TikTok App</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tiktokSettings?.configured ? `Client Key: ${tiktokSettings.tiktokClientKey}` : 'Necessário para conectar contas do TikTok de clientes'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tiktokSettings?.configured ? <Badge variant="success">Configurado</Badge> : <Badge variant="default">Não configurado</Badge>}
                  <Button type="button" variant="outline" size="sm" onClick={openTiktokModal}>
                    <span>{tiktokSettings?.configured ? 'Editar' : 'Configurar'}</span>
                  </Button>
                  {tiktokSettings?.configured && (
                    <button
                      onClick={handleRemoveTiktokSettings}
                      className="p-1.5 text-muted-foreground hover:text-error rounded-lg transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* YouTube App row */}
              <div className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FF0000]/10 text-[#FF0000]">
                    <SiYoutube size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">YouTube App</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {youtubeSettings?.configured ? `Client ID: ${youtubeSettings.youtubeClientId}` : 'Necessário para conectar canais do YouTube de clientes'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {youtubeSettings?.configured ? <Badge variant="success">Configurado</Badge> : <Badge variant="default">Não configurado</Badge>}
                  <Button type="button" variant="outline" size="sm" onClick={openYoutubeModal}>
                    <span>{youtubeSettings?.configured ? 'Editar' : 'Configurar'}</span>
                  </Button>
                  {youtubeSettings?.configured && (
                    <button
                      onClick={handleRemoveYoutubeSettings}
                      className="p-1.5 text-muted-foreground hover:text-error rounded-lg transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* WhatsApp row */}
              <div className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#25D366]">
                    <SiWhatsapp size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">WhatsApp (envio de aprovações)</p>
                    <p className="truncate text-xs text-muted-foreground">
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
              <div className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-info/10 text-info-dark flex items-center justify-center shrink-0">
                    <Mail size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">Email (SMTP)</p>
                    <p className="truncate text-xs text-muted-foreground">
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
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground/80">
                  <Contact size={20} />
                </div>
                <div>
                  <CardTitle>Contas do cliente</CardTitle>
                  <CardDescription>As redes de cada marca são conectadas individualmente, por cliente.</CardDescription>
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Button type="button" variant="outline" onClick={handleConnectMeta} loading={connectingMeta} disabled={!metaSettings?.configured} className="h-11 justify-center gap-2 rounded-xl">
                      {!connectingMeta && (
                        <>
                          <SiFacebook size={14} className="text-[#0866FF]" />
                          <span>Conectar Facebook</span>
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleConnectMeta} loading={connectingMeta} disabled={!metaSettings?.configured} className="h-11 justify-center gap-2 rounded-xl">
                      {!connectingMeta && (
                        <>
                          <BrandIcon platform="INSTAGRAM" size={14} />
                          <span>Conectar Instagram</span>
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleConnectLinkedin} loading={connectingLinkedin} disabled={!linkedinSettings?.configured} className="h-11 justify-center gap-2 rounded-xl">
                      {!connectingLinkedin && (
                        <>
                          <FaLinkedin size={14} className="text-[#0A66C2]" />
                          <span>Conectar LinkedIn</span>
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleConnectTiktok} loading={connectingTiktok} disabled={!tiktokSettings?.configured} className="h-11 justify-center gap-2 rounded-xl">
                      {!connectingTiktok && (
                        <>
                          <SiTiktok size={14} className="shrink-0 text-foreground" />
                          <span>Conectar TikTok</span>
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleConnectYoutube} loading={connectingYoutube} disabled={!youtubeSettings?.configured} className="h-11 justify-center gap-2 rounded-xl">
                      {!connectingYoutube && (
                        <>
                          <SiYoutube size={14} className="text-[#FF0000]" />
                          <span>Conectar YouTube</span>
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={openWhatsappConnectModal} disabled={!socialClientId} className="h-11 justify-center gap-2 rounded-xl">
                      <SiWhatsapp size={14} className="text-[#25D366]" />
                      <span>Conectar WhatsApp</span>
                    </Button>
                  </div>
                  {(!metaSettings?.configured || !linkedinSettings?.configured || !tiktokSettings?.configured || !youtubeSettings?.configured) && (
                    <p className="rounded-xl border border-warning/25 bg-warning/[0.06] px-3.5 py-2.5 text-xs text-foreground/80">
                      Alguns botões estão desativados porque o app dessa rede ainda não foi configurado na aba <span className="font-semibold">Agência</span>.
                    </p>
                  )}
                  <details className="group rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none font-medium text-foreground/80 marker:text-muted-foreground">Requisitos de cada rede</summary>
                    <p className="mt-2 leading-relaxed">Facebook e Instagram usam o mesmo login da Meta (a página precisa ter uma conta do Instagram profissional vinculada). LinkedIn conecta a uma Página de Empresa. TikTok e YouTube publicam apenas vídeo — TikTok fica em modo privado até o app passar pela auditoria do TikTok, e o YouTube exige reconectar a cada 7 dias até o app passar pela verificação do Google. WhatsApp publica como Status, usando uma instância do Evolution API já pareada ao número do cliente.</p>
                  </details>

                  <div className="border-t border-border/70 pt-5">
                    <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Canais conectados deste cliente</h4>
                    {loadingConnections ? (
                      <Skeleton className="h-16 w-full rounded-xl" />
                    ) : connections.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">Nenhuma conta conectada para este cliente ainda.</p>
                    ) : (
                      <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border">
                        {connections.map((conn) => {
                          const active = conn.status === 'ACTIVE'
                          const synced = conn.updatedAt || conn.createdAt
                          return (
                            <li key={conn.id} className="flex items-center gap-3.5 bg-card px-4 py-3.5">
                              <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
                                <BrandIcon platform={conn.platform} size={20} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm">
                                  <span className="truncate font-semibold text-foreground">{conn.accountName || PLATFORM_NAMES[conn.platform] || conn.platform}</span>
                                  <span className="text-xs text-muted-foreground">· {PLATFORM_NAMES[conn.platform] || conn.platform}</span>
                                </p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                                  <span className={cn('inline-flex items-center gap-1 font-medium', active ? 'text-success-dark dark:text-success' : 'text-warning-dark dark:text-warning')}>
                                    <span className={cn('size-1.5 rounded-full', active ? 'bg-success' : 'bg-warning')} />
                                    {active ? 'Ativa' : conn.status === 'PENDING' ? 'Aguardando' : 'Desconectada'}
                                  </span>
                                  {synced && <><span aria-hidden>·</span><span>Atualizada em {new Date(synced).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span></>}
                                </p>
                              </div>
                              <Button type="button" variant="outline" size="sm" onClick={() => handleDeleteConnection(conn.id)} className="shrink-0">
                                <Unplug size={14} />
                                <span className="hidden sm:inline">Desconectar</span>
                              </Button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Meta App Modal — guided setup wizard for first-timers, straight to the form for edits */}
      <Dialog open={showMetaModal} onOpenChange={setShowMetaModal}>
        <DialogContent>
          <DialogHeader icon={<DialogIcon className="border-transparent bg-[#0467DF]/10 text-[#0467DF]"><SiMeta size={20} /></DialogIcon>}>
                <DialogTitle>
                  {metaWizardStep <= META_WIZARD_STEPS.length
                    ? `Passo ${metaWizardStep} de ${META_WIZARD_STEPS.length + 1} — ${META_WIZARD_STEPS[metaWizardStep - 1].title}`
                    : metaSettings?.configured ? 'Editar Meta App' : `Passo ${META_WIZARD_STEPS.length + 1} de ${META_WIZARD_STEPS.length + 1} — Salvar credenciais`}
                </DialogTitle>
                <DialogDescription>Facebook + Instagram — registrado uma vez, usado para conectar a conta de qualquer cliente</DialogDescription>
          </DialogHeader>

          {metaWizardStep <= META_WIZARD_STEPS.length ? (
            <div className="space-y-4">
              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {META_WIZARD_STEPS.map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < metaWizardStep ? 'bg-primary' : 'bg-muted'}`} />
                ))}
              </div>

              <ul className="space-y-2.5">
                {META_WIZARD_STEPS[metaWizardStep - 1].items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-foreground/85">
                    <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground">{i + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Step 3 needs the actual redirect URI to copy */}
              {metaWizardStep === 3 && (
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
              )}

              {metaWizardStep === 1 && (
                <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary hover:underline">
                  Abrir developers.facebook.com/apps <ExternalLink size={12} />
                </a>
              )}

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                {metaWizardStep === 1 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setMetaWizardStep(META_WIZARD_STEPS.length + 1)}>
                    Já sei, ir direto pro formulário
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setMetaWizardStep((s) => s - 1)} className="gap-1">
                    <ChevronLeft size={14} /> Voltar
                  </Button>
                )}
                <Button type="button" size="sm" onClick={() => setMetaWizardStep((s) => s + 1)} className="gap-1">
                  Próximo <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          ) : (
            <>
              {metaSettings?.configured && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border text-xs">
                  <span className="text-muted-foreground">App ID: <span className="font-mono font-bold text-foreground">{metaSettings.metaAppId}</span> • Secret: <span className="font-mono">{metaSettings.metaAppSecretMasked}</span></span>
                </div>
              )}

              <form onSubmit={handleSaveMetaSettings} className="space-y-4" autoComplete="off">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="flex items-center justify-between gap-3 pt-2">
                  {!metaSettings?.configured && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setMetaWizardStep((s) => s - 1)} className="gap-1">
                      <ChevronLeft size={14} /> Voltar ao guia
                    </Button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button type="button" variant="ghost" onClick={() => setShowMetaModal(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!metaAppIdInput.trim() || !metaAppSecretInput.trim()} loading={savingMeta}>
                      {!savingMeta && <span>{metaSettings?.configured ? 'Substituir Meta App' : 'Salvar Meta App'}</span>}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* LinkedIn App Modal — guided setup wizard for first-timers, straight to the form for edits */}
      <Dialog open={showLinkedinModal} onOpenChange={setShowLinkedinModal}>
        <DialogContent>
          <DialogHeader icon={<DialogIcon className="border-transparent bg-[#0A66C2]/10 text-[#0A66C2]"><FaLinkedin size={20} /></DialogIcon>}>
                <DialogTitle>
                  {linkedinWizardStep <= LINKEDIN_WIZARD_STEPS.length
                    ? `Passo ${linkedinWizardStep} de ${LINKEDIN_WIZARD_STEPS.length + 1} — ${LINKEDIN_WIZARD_STEPS[linkedinWizardStep - 1].title}`
                    : linkedinSettings?.configured ? 'Editar LinkedIn App' : `Passo ${LINKEDIN_WIZARD_STEPS.length + 1} de ${LINKEDIN_WIZARD_STEPS.length + 1} — Salvar credenciais`}
                </DialogTitle>
                <DialogDescription>LinkedIn — registrado uma vez, usado para conectar a Página de Empresa de qualquer cliente</DialogDescription>
          </DialogHeader>

          {linkedinWizardStep <= LINKEDIN_WIZARD_STEPS.length ? (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5">
                {LINKEDIN_WIZARD_STEPS.map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < linkedinWizardStep ? 'bg-[#0A66C2]' : 'bg-muted'}`} />
                ))}
              </div>

              <ul className="space-y-2.5">
                {LINKEDIN_WIZARD_STEPS[linkedinWizardStep - 1].items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-foreground/85">
                    <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground">{i + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {linkedinWizardStep === 3 && (
                <div className="flex items-center gap-2 p-2.5 bg-background rounded-lg border border-border">
                  <span className="flex-1 min-w-0 truncate text-[11px] font-mono font-bold text-foreground/80">{LINKEDIN_CALLBACK_URL}</span>
                  <button
                    type="button"
                    onClick={handleCopyLinkedinCallbackUrl}
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Copiar URL"
                  >
                    {copiedLinkedinCallback ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  </button>
                </div>
              )}

              {linkedinWizardStep === 1 && (
                <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A66C2] hover:underline">
                  Abrir linkedin.com/developers/apps <ExternalLink size={12} />
                </a>
              )}

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                {linkedinWizardStep === 1 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLinkedinWizardStep(LINKEDIN_WIZARD_STEPS.length + 1)}>
                    Já sei, ir direto pro formulário
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLinkedinWizardStep((s) => s - 1)} className="gap-1">
                    <ChevronLeft size={14} /> Voltar
                  </Button>
                )}
                <Button type="button" size="sm" onClick={() => setLinkedinWizardStep((s) => s + 1)} className="gap-1">
                  Próximo <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          ) : (
            <>
              {linkedinSettings?.configured && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border text-xs">
                  <span className="text-muted-foreground">Client ID: <span className="font-mono font-bold text-foreground">{linkedinSettings.linkedinClientId}</span> • Secret: <span className="font-mono">{linkedinSettings.linkedinClientSecretMasked}</span></span>
                </div>
              )}

              <form onSubmit={handleSaveLinkedinSettings} className="space-y-4" autoComplete="off">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="linkedinClientId">Client ID</Label>
                    <Input id="linkedinClientId" name="linkedin_client_id" autoComplete="off" placeholder="Client ID" value={linkedinClientIdInput} onChange={(e) => setLinkedinClientIdInput(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="linkedinClientSecret">Client Secret</Label>
                    <Input
                      id="linkedinClientSecret"
                      name="linkedin_client_secret"
                      autoComplete="new-password"
                      type={showLinkedinSecret ? 'text' : 'password'}
                      placeholder="Client Secret"
                      value={linkedinClientSecretInput}
                      onChange={(e) => setLinkedinClientSecretInput(e.target.value)}
                      endAdornment={
                        <button type="button" onClick={() => setShowLinkedinSecret(!showLinkedinSecret)} className="text-muted-foreground hover:text-foreground p-1">
                          {showLinkedinSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      }
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium italic">
                  Não é o token de publicação — é só a credencial do seu app no LinkedIn, usada pelo servidor para autenticar o login. O token que de fato autoriza postar na Página é gerado automaticamente, por cliente, quando você clica em "Conectar LinkedIn" na aba Cliente.
                </p>
                <div className="flex items-center justify-between gap-3 pt-2">
                  {!linkedinSettings?.configured && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setLinkedinWizardStep((s) => s - 1)} className="gap-1">
                      <ChevronLeft size={14} /> Voltar ao guia
                    </Button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button type="button" variant="ghost" onClick={() => setShowLinkedinModal(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!linkedinClientIdInput.trim() || !linkedinClientSecretInput.trim()} loading={savingLinkedin}>
                      {!savingLinkedin && <span>{linkedinSettings?.configured ? 'Substituir LinkedIn App' : 'Salvar LinkedIn App'}</span>}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* TikTok App Modal — guided setup wizard for first-timers, straight to the form for edits */}
      <Dialog open={showTiktokModal} onOpenChange={setShowTiktokModal}>
        <DialogContent>
          <DialogHeader icon={<DialogIcon className="border-transparent text-[#fff]" style={{ backgroundColor: PLATFORM_COLORS.TIKTOK }}><SiTiktok size={20} /></DialogIcon>}>
                <DialogTitle>
                  {tiktokWizardStep <= TIKTOK_WIZARD_STEPS.length
                    ? `Passo ${tiktokWizardStep} de ${TIKTOK_WIZARD_STEPS.length + 1} — ${TIKTOK_WIZARD_STEPS[tiktokWizardStep - 1].title}`
                    : tiktokSettings?.configured ? 'Editar TikTok App' : `Passo ${TIKTOK_WIZARD_STEPS.length + 1} de ${TIKTOK_WIZARD_STEPS.length + 1} — Salvar credenciais`}
                </DialogTitle>
                <DialogDescription>TikTok — registrado uma vez, usado para conectar a conta de qualquer cliente</DialogDescription>
          </DialogHeader>

          {tiktokWizardStep <= TIKTOK_WIZARD_STEPS.length ? (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5">
                {TIKTOK_WIZARD_STEPS.map((_, i) => (
                  <div key={i} className={cn('h-1.5 flex-1 rounded-full', i >= tiktokWizardStep && 'bg-muted')} style={i < tiktokWizardStep ? { backgroundColor: PLATFORM_COLORS.TIKTOK } : undefined} />
                ))}
              </div>

              <ul className="space-y-2.5">
                {TIKTOK_WIZARD_STEPS[tiktokWizardStep - 1].items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-foreground/85">
                    <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {tiktokWizardStep === 3 && (
                <div className="flex items-center gap-2 p-2.5 bg-background rounded-lg border border-border">
                  <span className="flex-1 min-w-0 truncate text-[11px] font-mono font-bold text-foreground/80">{TIKTOK_CALLBACK_URL}</span>
                  <button
                    type="button"
                    onClick={handleCopyTiktokCallbackUrl}
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Copiar URL"
                  >
                    {copiedTiktokCallback ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  </button>
                </div>
              )}

              {tiktokWizardStep === 1 && (
                <a href="https://developers.tiktok.com/apps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline" style={{ color: PLATFORM_COLORS.TIKTOK }}>
                  Abrir developers.tiktok.com/apps <ExternalLink size={12} />
                </a>
              )}

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                {tiktokWizardStep === 1 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTiktokWizardStep(TIKTOK_WIZARD_STEPS.length + 1)}>
                    Já sei, ir direto pro formulário
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTiktokWizardStep((s) => s - 1)} className="gap-1">
                    <ChevronLeft size={14} /> Voltar
                  </Button>
                )}
                <Button type="button" size="sm" onClick={() => setTiktokWizardStep((s) => s + 1)} className="gap-1">
                  Próximo <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          ) : (
            <>
              {tiktokSettings?.configured && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border text-xs">
                  <span className="text-muted-foreground">Client Key: <span className="font-mono font-bold text-foreground">{tiktokSettings.tiktokClientKey}</span> • Secret: <span className="font-mono">{tiktokSettings.tiktokClientSecretMasked}</span></span>
                </div>
              )}

              <form onSubmit={handleSaveTiktokSettings} className="space-y-4" autoComplete="off">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tiktokClientKey">Client Key</Label>
                    <Input id="tiktokClientKey" name="tiktok_client_key" autoComplete="off" placeholder="Client Key" value={tiktokClientKeyInput} onChange={(e) => setTiktokClientKeyInput(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="tiktokClientSecret">Client Secret</Label>
                    <Input
                      id="tiktokClientSecret"
                      name="tiktok_client_secret"
                      autoComplete="new-password"
                      type={showTiktokSecret ? 'text' : 'password'}
                      placeholder="Client Secret"
                      value={tiktokClientSecretInput}
                      onChange={(e) => setTiktokClientSecretInput(e.target.value)}
                      endAdornment={
                        <button type="button" onClick={() => setShowTiktokSecret(!showTiktokSecret)} className="text-muted-foreground hover:text-foreground p-1">
                          {showTiktokSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      }
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium italic">
                  Não é o token de publicação — é só a credencial do seu app no TikTok, usada pelo servidor para autenticar o login. O token que de fato autoriza postar é gerado automaticamente, por cliente, quando você clica em "Conectar TikTok" na aba Cliente. Lembre-se: até o app passar pela auditoria do TikTok, os posts ficam visíveis só para a própria conta.
                </p>
                <div className="flex items-center justify-between gap-3 pt-2">
                  {!tiktokSettings?.configured && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setTiktokWizardStep((s) => s - 1)} className="gap-1">
                      <ChevronLeft size={14} /> Voltar ao guia
                    </Button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button type="button" variant="ghost" onClick={() => setShowTiktokModal(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!tiktokClientKeyInput.trim() || !tiktokClientSecretInput.trim()} loading={savingTiktok}>
                      {!savingTiktok && <span>{tiktokSettings?.configured ? 'Substituir TikTok App' : 'Salvar TikTok App'}</span>}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* YouTube App Modal — guided setup wizard for first-timers, straight to the form for edits */}
      <Dialog open={showYoutubeModal} onOpenChange={setShowYoutubeModal}>
        <DialogContent>
          <DialogHeader icon={<DialogIcon className="border-transparent bg-[#FF0000]/10 text-[#FF0000]"><SiYoutube size={20} /></DialogIcon>}>
                <DialogTitle>
                  {youtubeWizardStep <= YOUTUBE_WIZARD_STEPS.length
                    ? `Passo ${youtubeWizardStep} de ${YOUTUBE_WIZARD_STEPS.length + 1} — ${YOUTUBE_WIZARD_STEPS[youtubeWizardStep - 1].title}`
                    : youtubeSettings?.configured ? 'Editar YouTube App' : `Passo ${YOUTUBE_WIZARD_STEPS.length + 1} de ${YOUTUBE_WIZARD_STEPS.length + 1} — Salvar credenciais`}
                </DialogTitle>
                <DialogDescription>YouTube (Google) — registrado uma vez, usado para conectar o canal de qualquer cliente</DialogDescription>
          </DialogHeader>

          {youtubeWizardStep <= YOUTUBE_WIZARD_STEPS.length ? (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5">
                {YOUTUBE_WIZARD_STEPS.map((_, i) => (
                  <div key={i} className={cn('h-1.5 flex-1 rounded-full', i < youtubeWizardStep ? 'bg-[#FF0000]' : 'bg-muted')} />
                ))}
              </div>

              <ul className="space-y-2.5">
                {YOUTUBE_WIZARD_STEPS[youtubeWizardStep - 1].items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-foreground/85">
                    <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground">{i + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {youtubeWizardStep === 3 && (
                <div className="flex items-center gap-2 p-2.5 bg-background rounded-lg border border-border">
                  <span className="flex-1 min-w-0 truncate text-[11px] font-mono font-bold text-foreground/80">{YOUTUBE_CALLBACK_URL}</span>
                  <button
                    type="button"
                    onClick={handleCopyYoutubeCallbackUrl}
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Copiar URL"
                  >
                    {copiedYoutubeCallback ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  </button>
                </div>
              )}

              {youtubeWizardStep === 1 && (
                <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF0000] hover:underline">
                  Abrir console.cloud.google.com <ExternalLink size={12} />
                </a>
              )}

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                {youtubeWizardStep === 1 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setYoutubeWizardStep(YOUTUBE_WIZARD_STEPS.length + 1)}>
                    Já sei, ir direto pro formulário
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setYoutubeWizardStep((s) => s - 1)} className="gap-1">
                    <ChevronLeft size={14} /> Voltar
                  </Button>
                )}
                <Button type="button" size="sm" onClick={() => setYoutubeWizardStep((s) => s + 1)} className="gap-1">
                  Próximo <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          ) : (
            <>
              {youtubeSettings?.configured && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border text-xs">
                  <span className="text-muted-foreground">Client ID: <span className="font-mono font-bold text-foreground">{youtubeSettings.youtubeClientId}</span> • Secret: <span className="font-mono">{youtubeSettings.youtubeClientSecretMasked}</span></span>
                </div>
              )}

              <form onSubmit={handleSaveYoutubeSettings} className="space-y-4" autoComplete="off">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="youtubeClientId">Client ID</Label>
                    <Input id="youtubeClientId" name="youtube_client_id" autoComplete="off" placeholder="Client ID" value={youtubeClientIdInput} onChange={(e) => setYoutubeClientIdInput(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="youtubeClientSecret">Client Secret</Label>
                    <Input
                      id="youtubeClientSecret"
                      name="youtube_client_secret"
                      autoComplete="new-password"
                      type={showYoutubeSecret ? 'text' : 'password'}
                      placeholder="Client Secret"
                      value={youtubeClientSecretInput}
                      onChange={(e) => setYoutubeClientSecretInput(e.target.value)}
                      endAdornment={
                        <button type="button" onClick={() => setShowYoutubeSecret(!showYoutubeSecret)} className="text-muted-foreground hover:text-foreground p-1">
                          {showYoutubeSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      }
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium italic">
                  Não é o token de publicação — é só a credencial do seu projeto do Google Cloud, usada pelo servidor para autenticar o login. O token que de fato autoriza postar no canal é gerado automaticamente, por cliente, quando você clica em "Conectar YouTube" na aba Cliente. Lembre-se: até o projeto passar pela verificação do Google, a conexão expira a cada 7 dias.
                </p>
                <div className="flex items-center justify-between gap-3 pt-2">
                  {!youtubeSettings?.configured && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setYoutubeWizardStep((s) => s - 1)} className="gap-1">
                      <ChevronLeft size={14} /> Voltar ao guia
                    </Button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button type="button" variant="ghost" onClick={() => setShowYoutubeModal(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!youtubeClientIdInput.trim() || !youtubeClientSecretInput.trim()} loading={savingYoutube}>
                      {!savingYoutube && <span>{youtubeSettings?.configured ? 'Substituir YouTube App' : 'Salvar YouTube App'}</span>}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp (client) Connect Modal — no OAuth, no wizard: just the client's already-
         paired Evolution instance name, reusing the agency's own Evolution API server. */}
      <Dialog open={showWhatsappConnectModal} onOpenChange={setShowWhatsappConnectModal}>
        <DialogContent size="sm">
          <DialogHeader icon={<DialogIcon className="border-transparent bg-[#25D366]/10 text-[#25D366]"><SiWhatsapp size={20} /></DialogIcon>}>
                <DialogTitle>Conectar WhatsApp do cliente</DialogTitle>
                <DialogDescription>Publica como Status no WhatsApp do próprio cliente</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConnectClientWhatsapp} className="space-y-4" autoComplete="off">
            <div>
              <Label htmlFor="whatsappInstance">Nome da instância</Label>
              <Input
                id="whatsappInstance"
                name="whatsapp_instance"
                autoComplete="off"
                placeholder="Ex: cliente-natur-erva"
                value={whatsappInstanceInput}
                onChange={(e) => setWhatsappInstanceInput(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-muted-foreground font-medium italic">
              A instância já precisa existir e estar conectada (WhatsApp do cliente pareado) no seu servidor Evolution API — este passo só registra o nome dela aqui.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowWhatsappConnectModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={!whatsappInstanceInput.trim()} loading={connectingClientWhatsapp}>
                {!connectingClientWhatsapp && <span>Conectar</span>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SMTP Modal */}
      <Dialog open={showSmtpModal} onOpenChange={setShowSmtpModal}>
        <DialogContent size="lg">
          <DialogHeader icon={<DialogIcon className="border-transparent bg-info/10 text-info-dark"><Mail size={20} /></DialogIcon>}>
                <DialogTitle>{smtpSettings?.configured ? 'Editar Email (SMTP)' : 'Configurar Email (SMTP)'}</DialogTitle>
                <DialogDescription>Servidor único da agência — envia os links de aprovação por email a qualquer cliente</DialogDescription>
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
                <Label htmlFor="smtpFromEmail">Email de envio *</Label>
                <Input id="smtpFromEmail" name="smtp_from_email" autoComplete="off" type="email" placeholder="contato@suaagencia.com" value={smtpForm.fromEmail} onChange={(e) => setSmtpForm({ ...smtpForm, fromEmail: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="smtpFromName">Nome de exibição</Label>
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
                <span>Testar conexão</span>
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowSmtpModal(false)}>Cancelar</Button>
                <Button type="submit" loading={savingSmtp}>
                  {!savingSmtp && <span>Salvar email</span>}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* WhatsApp QR Modal */}
      <Dialog open={showWaModal} onOpenChange={setShowWaModal}>
        <DialogContent size="sm">
          <DialogHeader icon={<DialogIcon className="border-transparent bg-[#25D366]/10 text-[#25D366]"><QrCode size={20} /></DialogIcon>}>
                <DialogTitle>Conectar WhatsApp da agência</DialogTitle>
                <DialogDescription>Escaneie com o WhatsApp da agência no celular (Aparelhos Conectados)</DialogDescription>
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
        <DialogContent size="sm">
          <DialogHeader icon={<DialogIcon className="border-transparent bg-[#0866FF]/10 text-[#0866FF]"><SiFacebook size={20} /></DialogIcon>}>
                <DialogTitle>Qual página é deste cliente?</DialogTitle>
                <DialogDescription>
                  {clients.find((c) => c.id === pagePickerClientId)?.name
                    ? `Sua conta do Facebook tem acesso a mais de uma página. Selecione a(s) que pertence(m) a ${clients.find((c) => c.id === pagePickerClientId)?.name}.`
                    : 'Sua conta do Facebook tem acesso a mais de uma página. Selecione a(s) que pertence(m) a este cliente.'}
                </DialogDescription>
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
                        <BrandIcon platform="INSTAGRAM" size={11} /> Instagram vinculado
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

      {/* Organization Picker — the LinkedIn member administers more than one Company Page;
         pick which one(s) belong to this client before connecting anything. */}
      <Dialog open={!!orgPickerToken} onOpenChange={(open) => { if (!open) setOrgPickerToken(null) }}>
        <DialogContent size="sm">
          <DialogHeader icon={<DialogIcon className="border-transparent bg-[#0A66C2]/10 text-[#0A66C2]"><FaLinkedin size={20} /></DialogIcon>}>
                <DialogTitle>Qual página de empresa é deste cliente?</DialogTitle>
                <DialogDescription>
                  {clients.find((c) => c.id === orgPickerClientId)?.name
                    ? `Sua conta do LinkedIn administra mais de uma Página de Empresa. Selecione a(s) que pertence(m) a ${clients.find((c) => c.id === orgPickerClientId)?.name}.`
                    : 'Sua conta do LinkedIn administra mais de uma Página de Empresa. Selecione a(s) que pertence(m) a este cliente.'}
                </DialogDescription>
          </DialogHeader>

          {loadingPendingOrgs ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {pendingOrgs.map((org) => (
                <label key={org.urn} className="flex items-center gap-3 p-3 bg-muted rounded-xl border border-border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOrgUrns.includes(org.urn)}
                    onChange={() => toggleOrgSelection(org.urn)}
                    className="rounded border-grey-300 text-primary focus:ring-primary shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate">{org.name}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setOrgPickerToken(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmOrgSelection} loading={confirmingOrgSelection} disabled={selectedOrgUrns.length === 0}>
              {!confirmingOrgSelection && <span>Conectar {selectedOrgUrns.length > 0 ? `(${selectedOrgUrns.length})` : ''}</span>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
