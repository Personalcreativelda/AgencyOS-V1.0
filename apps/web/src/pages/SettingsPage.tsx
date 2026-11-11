import React, { useEffect, useState } from 'react'
import {
  Building, Users, Plus, Trash2, Sparkles, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Copy,
} from 'lucide-react'
import { RiOpenaiFill } from 'react-icons/ri'
import { SiAnthropic, SiGooglegemini } from 'react-icons/si'
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
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/Card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogIcon } from '@/components/ui/Dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/Select'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'
import { Page, PageHeader } from '@/components/layout/Page'

// Original brand marks + colours for the AI providers.
const AI_BRAND: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; bg: string }> = {
  openai: { icon: RiOpenaiFill, bg: '#0D0D0D' },
  anthropic: { icon: SiAnthropic, bg: '#D97757' },
  gemini: { icon: SiGooglegemini, bg: '#4285F4' },
}

function AiMark({ provider }: { provider: string }) {
  const b = AI_BRAND[provider]
  if (!b) return <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground/80"><Sparkles size={19} /></span>
  return <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[#fff]" style={{ background: b.bg }}><b.icon size={20} /></span>
}

/** Read-only field in the Stitch "definition" style. */
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[13px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 text-sm font-medium text-foreground">{children}</dd>
    </div>
  )
}

function localTime(tz?: string) {
  if (!tz) return null
  try {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  } catch {
    return null
  }
}

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
]

const TEXT_MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o mini (rápido e barato)' },
    { value: 'gpt-4o', label: 'GPT-4o (mais qualidade)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  gemini: [
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (rápido e barato)' },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (mais qualidade)' },
  ],
  anthropic: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (rápido e barato)' },
    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 (equilibrado)' },
    { value: 'claude-opus-5', label: 'Claude Opus 5 (mais qualidade)' },
  ],
}

// Countries/timezones this product's userbase actually needs (Portuguese-speaking markets +
// a couple of generic anchors) — picking a country auto-fills a sensible default timezone,
// but the timezone stays independently editable right after in case that default is wrong.
const COUNTRY_OPTIONS = [
  { value: 'Brasil (BR)', label: 'Brasil', timezone: 'America/Sao_Paulo' },
  { value: 'Moçambique (MZ)', label: 'Moçambique', timezone: 'Africa/Maputo' },
  { value: 'Portugal (PT)', label: 'Portugal', timezone: 'Europe/Lisbon' },
  { value: 'Angola (AO)', label: 'Angola', timezone: 'Africa/Luanda' },
  { value: 'Cabo Verde (CV)', label: 'Cabo Verde', timezone: 'Atlantic/Cape_Verde' },
  { value: 'Guiné-Bissau (GW)', label: 'Guiné-Bissau', timezone: 'Africa/Bissau' },
  { value: 'São Tomé e Príncipe (ST)', label: 'São Tomé e Príncipe', timezone: 'Africa/Sao_Tome' },
  { value: 'Timor-Leste (TL)', label: 'Timor-Leste', timezone: 'Asia/Dili' },
]

const TIMEZONE_OPTIONS = [
  { value: 'America/Sao_Paulo', label: 'América/São Paulo — Brasil (UTC-3)' },
  { value: 'Africa/Maputo', label: 'África/Maputo — Moçambique (UTC+2)' },
  { value: 'Europe/Lisbon', label: 'Europa/Lisboa — Portugal (UTC+0/+1)' },
  { value: 'Africa/Luanda', label: 'África/Luanda — Angola (UTC+1)' },
  { value: 'Atlantic/Cape_Verde', label: 'Atlântico/Cabo Verde (UTC-1)' },
  { value: 'Africa/Bissau', label: 'África/Bissau — Guiné-Bissau (UTC+0)' },
  { value: 'Africa/Sao_Tome', label: 'África/São Tomé (UTC+0)' },
  { value: 'Asia/Dili', label: 'Ásia/Dili — Timor-Leste (UTC+9)' },
]

const LOCALE_OPTIONS = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'pt-PT', label: 'Português (Portugal/África)' },
  { value: 'en-US', label: 'English' },
]

const IMAGE_MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-image-1', label: 'GPT Image 1 (modelo atual da OpenAI)' },
    { value: 'dall-e-3', label: 'DALL·E 3 (contas mais antigas)' },
    { value: 'dall-e-2', label: 'DALL·E 2 (mais barato, contas mais antigas)' },
  ],
  gemini: [
    { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
  ],
  anthropic: [], // Claude não gera imagens
}

export function SettingsPage() {
  const { user } = useAuthStore()
  const [agency, setAgency] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Agency region/timezone modal — country, timezone and locale used to have no edit path at
  // all (only ever displayed, with a hardcoded "Brasil (BR)" fallback that lied for every
  // agency outside Brazil), which is exactly what let a Mozambique agency's timezone silently
  // default to America/Sao_Paulo.
  const [showAgencyModal, setShowAgencyModal] = useState(false)
  const [agencyCountry, setAgencyCountry] = useState('')
  const [agencyTimezone, setAgencyTimezone] = useState('America/Sao_Paulo')
  const [agencyLocale, setAgencyLocale] = useState('pt-BR')
  const [savingAgency, setSavingAgency] = useState(false)

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MANAGER')

  // AI integrations — an agency can connect several providers at once (OpenAI, Gemini,
  // Anthropic) and assign which one handles text tasks vs image tasks.
  const [aiProviders, setAiProviders] = useState<any[]>([])
  const [aiRouting, setAiRouting] = useState<{ textProvider: string | null; imageProvider: string | null }>({ textProvider: null, imageProvider: null })
  const [savingRouting, setSavingRouting] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<string | null>(null) // null = connecting a new provider
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [aiProvider, setAiProvider] = useState('openai')
  const [textModel, setTextModel] = useState('gpt-4o-mini')
  const [imageModel, setImageModel] = useState('gpt-image-1')
  const [savingAi, setSavingAi] = useState(false)
  const [testingAi, setTestingAi] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const connectedProviderValues = aiProviders.map((p) => p.provider)
  const availableToAdd = AI_PROVIDERS.filter((p) => !connectedProviderValues.includes(p.value))

  const loadAiSettings = async () => {
    const { data } = await api.get('/ai/settings')
    setAiProviders(data.providers || [])
    setAiRouting({ textProvider: data.textProvider || null, imageProvider: data.imageProvider || null })
  }

  useEffect(() => {
    async function load() {
      try {
        const [agRes, memRes] = await Promise.all([
          api.get('/agencies/current'),
          api.get('/agencies/current/members'),
        ])
        setAgency(agRes.data)
        setMembers(memRes.data || [])
        await loadAiSettings()
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleTestAi = async () => {
    if (!apiKeyInput.trim()) return
    setTestingAi(true)
    setTestResult(null)
    try {
      const { data } = await api.post('/ai/settings/test', { apiKey: apiKeyInput.trim(), provider: aiProvider, textModel })
      setTestResult({ success: true, message: `Conectado com sucesso ao modelo ${data.model}.` })
    } catch (err: any) {
      setTestResult({ success: false, message: getErrorMessage(err, 'Não foi possível conectar com essa chave.') })
    } finally {
      setTestingAi(false)
    }
  }

  const openAiModal = (provider?: string) => {
    const existing = provider ? aiProviders.find((p) => p.provider === provider) : null
    const initialProvider = provider || availableToAdd[0]?.value || 'openai'
    setEditingProvider(provider || null)
    setApiKeyInput('')
    setTestResult(null)
    setAiProvider(initialProvider)
    setTextModel(existing?.textModel || TEXT_MODELS_BY_PROVIDER[initialProvider][0].value)
    setImageModel(existing?.imageModel || IMAGE_MODELS_BY_PROVIDER[initialProvider][0]?.value || '')
    setShowAiModal(true)
  }

  const handleChangeProvider = (value: string) => {
    setAiProvider(value)
    setTextModel(TEXT_MODELS_BY_PROVIDER[value][0].value)
    setImageModel(IMAGE_MODELS_BY_PROVIDER[value][0]?.value || '')
    setTestResult(null)
  }

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKeyInput.trim()) return
    setSavingAi(true)
    try {
      await api.put('/ai/settings', { apiKey: apiKeyInput.trim(), provider: aiProvider, textModel, imageModel: imageModel || undefined })
      await loadAiSettings()
      setApiKeyInput('')
      setTestResult(null)
      setShowAiModal(false)
      toast.success(`${AI_PROVIDERS.find((p) => p.value === aiProvider)?.label} conectado!`)
    } catch (err: any) {
      toast.error('Erro ao salvar a integração de IA', getErrorMessage(err))
    } finally {
      setSavingAi(false)
    }
  }

  const handleRemoveAi = async (provider: string) => {
    const ok = await confirmDialog({
      title: `Remover ${AI_PROVIDERS.find((p) => p.value === provider)?.label}?`,
      description: 'Tarefas apontadas para esse provedor passam a usar outro conectado (ou o padrão do servidor, se nenhum sobrar).',
      variant: 'destructive',
      confirmLabel: 'Remover',
    })
    if (!ok) return
    try {
      await api.delete(`/ai/settings/${provider}`)
      await loadAiSettings()
    } catch (err: any) {
      toast.error('Erro ao remover a integração de IA', getErrorMessage(err))
    }
  }

  const handleChangeRouting = async (task: 'textProvider' | 'imageProvider', value: string) => {
    const next = { ...aiRouting, [task]: value }
    setAiRouting(next)
    setSavingRouting(true)
    try {
      const { data } = await api.put('/ai/settings/routing', next)
      setAiRouting({ textProvider: data.textProvider || null, imageProvider: data.imageProvider || null })
      toast.success('Roteamento de IA atualizado!')
    } catch (err: any) {
      await loadAiSettings() // revert to server state
      toast.error('Erro ao atualizar o roteamento', getErrorMessage(err))
    } finally {
      setSavingRouting(false)
    }
  }

  const handleUploadAgencyLogo = async (file: File) => {
    try {
      const { publicUrl } = await uploadFile(file)
      const { data } = await api.patch('/agencies/current', { logoUrl: publicUrl })
      setAgency(data)
    } catch (err) {
      toast.error('Erro ao enviar o logotipo da agência', getErrorMessage(err))
    }
  }

  const openAgencyModal = () => {
    setAgencyCountry(agency?.country || '')
    setAgencyTimezone(agency?.timezone || 'America/Sao_Paulo')
    setAgencyLocale(agency?.locale || 'pt-BR')
    setShowAgencyModal(true)
  }

  const handleChangeAgencyCountry = (value: string) => {
    setAgencyCountry(value)
    const match = COUNTRY_OPTIONS.find((c) => c.value === value)
    if (match) setAgencyTimezone(match.timezone)
  }

  const handleSaveAgency = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingAgency(true)
    try {
      const { data } = await api.patch('/agencies/current', {
        country: agencyCountry,
        timezone: agencyTimezone,
        locale: agencyLocale,
      })
      setAgency(data)
      setShowAgencyModal(false)
      toast.success('Dados da agência atualizados!')
    } catch (err) {
      toast.error('Erro ao salvar os dados da agência', getErrorMessage(err))
    } finally {
      setSavingAgency(false)
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
      toast.success('Membro adicionado com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao convidar membro', getErrorMessage(err))
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    const ok = await confirmDialog({ title: 'Remover este membro da agência?', description: 'A pessoa perde o acesso imediatamente. Os conteúdos que ela criou continuam na agência.', variant: 'destructive', confirmLabel: 'Remover' })
    if (!ok) return
    try {
      await api.delete(`/agencies/current/members/${memberId}`)
      setMembers(members.filter((m) => m.id !== memberId))
    } catch (err: any) {
      toast.error('Erro ao remover membro', getErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <Page narrow className="max-w-5xl">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </Page>
    )
  }

  return (
    <Page narrow className="max-w-5xl">
      <PageHeader
        title="Configurações"
        description="Dados da agência, membros da equipe, permissões de acesso e integrações de IA."
      />

      {/* Agency Details */}
      <Card>
        <CardHeader className="items-start">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2"><Building size={17} className="text-muted-foreground" />Dados da agência</CardTitle>
            <CardDescription>Identidade e preferências aplicadas a publicações, relatórios e portais do cliente.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={openAgencyModal}>Editar</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-5 border-t border-border/70 pt-5 md:grid-cols-[200px_1fr]">
            <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 p-4 md:flex-col md:justify-center md:gap-2 md:p-5 md:text-center">
              <UploadableAvatar
                src={agency?.logoUrl}
                rounded="rounded-2xl"
                className="h-16 w-16 bg-primary/10"
                fallback={<Building size={26} className="text-primary-dark" />}
                onUpload={handleUploadAgencyLogo}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Logo da agência</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Toque na imagem para alterar · PNG ou SVG</p>
              </div>
            </div>
            <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome da agência"><span className="truncate">{agency?.name}</span></Field>
              <Field label="Identificador (slug)">
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{agency?.slug}</span>
                {agency?.slug && (
                  <button
                    type="button"
                    aria-label="Copiar identificador"
                    title="Copiar"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => { navigator.clipboard.writeText(agency.slug); toast.success('Identificador copiado.') }}
                  >
                    <Copy size={14} />
                  </button>
                )}
              </Field>
              <Field label="País / região">{COUNTRY_OPTIONS.find((c) => c.value === agency?.country)?.label || agency?.country || 'Não configurado'}</Field>
              <Field label="Idioma padrão">{LOCALE_OPTIONS.find((l) => l.value === agency?.locale)?.label || agency?.locale || 'Não configurado'}</Field>
              <Field label="Fuso horário" className="sm:col-span-2">
                <span className="min-w-0 flex-1 truncate">{TIMEZONE_OPTIONS.find((t) => t.value === agency?.timezone)?.label || agency?.timezone || 'Não configurado'}</span>
                {localTime(agency?.timezone) && <span className="shrink-0 text-xs text-muted-foreground">Agora: {localTime(agency?.timezone)}</span>}
              </Field>
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* Agency Region/Timezone Modal */}
      <Dialog open={showAgencyModal} onOpenChange={setShowAgencyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar região da agência</DialogTitle>
            <DialogDescription>
              O fuso horário é usado para exibir e agendar publicações — configure certo para evitar posts saindo na hora errada.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAgency} className="space-y-4">
            <div>
              <Label htmlFor="agencyCountry">País / região</Label>
              <Select value={agencyCountry} onValueChange={handleChangeAgencyCountry}>
                <SelectTrigger id="agencyCountry"><SelectValue placeholder="Selecione um país" /></SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="agencyTimezone">Fuso horário</Label>
              <Select value={agencyTimezone} onValueChange={setAgencyTimezone}>
                <SelectTrigger id="agencyTimezone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="agencyLocale">Idioma padrão</Label>
              <Select value={agencyLocale} onValueChange={setAgencyLocale}>
                <SelectTrigger id="agencyLocale"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCALE_OPTIONS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAgencyModal(false)}>Cancelar</Button>
              <Button type="submit" loading={savingAgency}>
                {!savingAgency && <span>Salvar</span>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Team Members */}
      <Card>
        <CardHeader className="items-start">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Users size={17} className="text-muted-foreground" />Membros da equipe
              <Badge variant="success" className="text-[11px]">{members.length} {members.length === 1 ? 'membro' : 'membros'}</Badge>
            </CardTitle>
            <CardDescription>Pessoas com acesso ao painel da agência e o papel de cada uma.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowInviteModal(true)}>
            <Plus size={14} />
            <span>Adicionar membro</span>
          </Button>
        </CardHeader>

        <CardContent>
          <ul className="divide-y divide-border/70 border-t border-border/70">
            {members.map((member) => {
              const isMe = !!user && (member.user?.email === user.email || member.userId === user.id)
              return (
                <li key={member.id} className="flex items-center gap-3.5 py-3.5">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback>{getInitials(member.user?.name || 'U')}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
                      <span className="truncate">{member.user?.name}</span>
                      {isMe && <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Você</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.user?.email}<span className="sm:hidden"> · {ROLE_LABELS[member.role] || member.role}</span></p>
                  </div>
                  <Badge dot variant={member.role === 'OWNER' ? 'success' : 'default'} className="hidden shrink-0 sm:inline-flex">{ROLE_LABELS[member.role] || member.role}</Badge>
                  {member.role !== 'OWNER' && user?.role === 'OWNER' ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      aria-label={`Remover ${member.user?.name || 'membro'}`}
                      title="Remover membro"
                      className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : <span className="hidden w-[31px] shrink-0 sm:block" aria-hidden />}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      {/* AI Integrations */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Sparkles size={17} className="text-muted-foreground" />Integrações de IA
              {aiProviders.length > 0 && <Badge variant="success" className="text-[11px]">{aiProviders.length} {aiProviders.length === 1 ? 'provedor ativo' : 'provedores ativos'}</Badge>}
            </CardTitle>
            <CardDescription>Chaves próprias para texto, estratégia do Brand Brain e criação de imagens. Escolha quem faz cada tarefa.</CardDescription>
          </div>

          {availableToAdd.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => openAiModal()}>
              <Plus size={14} />
              <span>Conectar provedor</span>
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-2">
          {aiProviders.length === 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground/80">
                  <Sparkles size={19} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">Nenhum provedor conectado</p>
                  <p className="text-xs text-muted-foreground">Sem chave própria, o app usa o padrão do servidor (ou respostas mock).</p>
                </div>
              </div>
              <Button size="sm" onClick={() => openAiModal()}>
                <Plus size={14} />
                <span>Conectar provedor</span>
              </Button>
            </div>
          ) : (
            aiProviders.map((p) => (
              <div
                key={p.provider}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-grey-400 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <AiMark provider={p.provider} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{AI_PROVIDERS.find((a) => a.value === p.provider)?.label || p.provider}</p>
                    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-medium text-success-dark dark:text-success"><span className="size-1.5 rounded-full bg-success" />Conectado</span>
                      <span aria-hidden>·</span>
                      <span className="truncate font-mono">{p.apiKeyMasked}</span>
                      <span aria-hidden>·</span>
                      <span className="truncate">{TEXT_MODELS_BY_PROVIDER[p.provider]?.find((m) => m.value === p.textModel)?.label || p.textModel}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {aiRouting.textProvider === p.provider && <Badge variant="success">Texto</Badge>}
                  {aiRouting.imageProvider === p.provider && <Badge variant="success">Imagem</Badge>}
                  <Button type="button" variant="outline" size="sm" onClick={() => openAiModal(p.provider)}>
                    <span>Editar</span>
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleRemoveAi(p.provider)}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"
                    title="Remover"
                    aria-label="Remover provedor"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}

          {aiProviders.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <Label>Provedor para tarefas de texto</Label>
                <Select
                  value={aiRouting.textProvider || ''}
                  onValueChange={(v) => handleChangeRouting('textProvider', v)}
                  disabled={savingRouting}
                >
                  <SelectTrigger><SelectValue placeholder="Escolha um provedor" /></SelectTrigger>
                  <SelectContent>
                    {aiProviders.map((p) => (
                      <SelectItem key={p.provider} value={p.provider}>{AI_PROVIDERS.find((a) => a.value === p.provider)?.label || p.provider}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground font-medium mt-1.5">Calendário, legendas, hooks, Brand Brain, feedback...</p>
              </div>
              <div>
                <Label>Provedor para tarefas de imagem</Label>
                <Select
                  value={aiRouting.imageProvider || ''}
                  onValueChange={(v) => handleChangeRouting('imageProvider', v)}
                  disabled={savingRouting}
                >
                  <SelectTrigger><SelectValue placeholder="Escolha um provedor" /></SelectTrigger>
                  <SelectContent>
                    {aiProviders.filter((p) => p.imageCapable).map((p) => (
                      <SelectItem key={p.provider} value={p.provider}>{AI_PROVIDERS.find((a) => a.value === p.provider)?.label || p.provider}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground font-medium mt-1.5">
                  {aiProviders.some((p) => p.imageCapable) ? 'Geração de criativos e análise de referências visuais.' : 'Conecte OpenAI ou Gemini para gerar imagens.'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Integration Modal */}
      <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
        <DialogContent size="lg">
          <DialogHeader icon={<DialogIcon className="border-transparent bg-primary/10 text-primary-dark"><Sparkles size={20} /></DialogIcon>}>
                <DialogTitle>{editingProvider ? `Editar ${AI_PROVIDERS.find((p) => p.value === editingProvider)?.label}` : 'Conectar Provedor de IA'}</DialogTitle>
                <DialogDescription>Conecte sua própria chave de API para gerar legendas, estratégias e propostas de imagem</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAi} className="space-y-4">
            <div>
              <Label htmlFor="aiProvider">Provedor</Label>
              <Select value={aiProvider} onValueChange={handleChangeProvider} disabled={!!editingProvider}>
                <SelectTrigger id="aiProvider"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(editingProvider ? AI_PROVIDERS : availableToAdd).map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="apiKey">{editingProvider ? 'Substituir chave de API' : `Chave de API — ${AI_PROVIDERS.find((p) => p.value === aiProvider)?.label}`}</Label>
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder={aiProvider === 'openai' ? 'sk-...' : aiProvider === 'anthropic' ? 'sk-ant-...' : 'AIza...'}
                value={apiKeyInput}
                onChange={(e) => { setApiKeyInput(e.target.value); setTestResult(null) }}
                endAdornment={
                  <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="text-muted-foreground hover:text-foreground p-1">
                    {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />
              <p className="text-[11px] text-muted-foreground font-medium mt-1.5">
                Sua chave fica criptografada no banco e é usada só para gerar conteúdo desta agência — o custo de uso vai direto para sua conta no provedor escolhido.
              </p>
            </div>

            <div className={`grid grid-cols-1 gap-4 ${IMAGE_MODELS_BY_PROVIDER[aiProvider]?.length ? 'sm:grid-cols-2' : ''}`}>
              <div>
                <Label htmlFor="textModel">Modelo de texto</Label>
                <Select value={textModel} onValueChange={setTextModel}>
                  <SelectTrigger id="textModel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEXT_MODELS_BY_PROVIDER[aiProvider].map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {IMAGE_MODELS_BY_PROVIDER[aiProvider]?.length > 0 ? (
                <div>
                  <Label htmlFor="imageModel">Modelo de imagem</Label>
                  <Select value={imageModel} onValueChange={setImageModel}>
                    <SelectTrigger id="imageModel"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IMAGE_MODELS_BY_PROVIDER[aiProvider].map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground font-medium self-end pb-2.5">
                  {AI_PROVIDERS.find((p) => p.value === aiProvider)?.label} não gera imagens — configure OpenAI ou Gemini pra isso.
                </p>
              )}
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${testResult.success ? 'bg-success/10 text-success-dark' : 'bg-error/10 text-error-dark'}`}>
                {testResult.success ? <CheckCircle2 size={15} className="shrink-0" /> : <XCircle size={15} className="shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button type="button" variant="outline" size="sm" disabled={!apiKeyInput.trim() || testingAi} onClick={handleTestAi}>
                {testingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Testar conexão</span>
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowAiModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={!apiKeyInput.trim()} loading={savingAi}>
                  {!savingAi && <span>Salvar integração</span>}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Member Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar membro para agência</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <Label htmlFor="inviteEmail">Email do usuário *</Label>
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
              <Label htmlFor="inviteRole">Cargo / permissão *</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="inviteRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="MANAGER">Gestor de contas</SelectItem>
                  <SelectItem value="DESIGNER">Designer</SelectItem>
                  <SelectItem value="COPYWRITER">Copywriter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar membro</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
