import React, { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Sparkles, Plus, Trash2,
  CheckCircle2, ArrowLeft, Send, Mail, Phone, Globe, Pencil, X, ImagePlus, Loader2,
  Brain, Shield, BarChart3, Palette, MessageCircle, User,
  AlertTriangle, ArrowRight, CalendarRange, CircleDashed, Info,
} from 'lucide-react'
import api from '@/lib/api'
import { uploadFile } from '@/lib/upload'
import { getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Meta } from '@/components/ui/List'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { UploadableAvatar } from '@/components/ui/UploadableAvatar'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'
import { Page, PageHeader } from '@/components/layout/Page'

const TABS = [
  { id: 'brand', label: 'Perfil & Identidade', icon: Brain },
  { id: 'personas', label: 'Personas', icon: User },
  { id: 'rules', label: 'Regras da Marca (DO / DONT)', icon: Shield },
  { id: 'pillars', label: 'Pilares de Conteúdo', icon: BarChart3 },
  { id: 'colors', label: 'Cores, Estilo & Referências', icon: Palette },
  { id: 'feedback', label: 'Memória de Feedback', icon: MessageCircle },
]

const CALIBRATION_TABS: Record<string, string> = { personas: 'personas', rules: 'rules', pillars: 'pillars', colors: 'colors' }

/** Brand Brain readiness for this client, computed from what is actually filled in. */
function BrandBrainCalibration({ profile, counts, onOpenTab }: {
  profile: any
  counts: { personas: number; rules: number; pillars: number; colors: number; feedback: number }
  onOpenTab: (tab: string) => void
}) {
  const filled = (v?: string) => Boolean(v && String(v).trim().length > 0)
  const modules = [
    { key: 'summary', label: 'Resumo & posicionamento', value: ((filled(profile.brandSummary) ? 1 : 0) + (filled(profile.positioning) ? 1 : 0)) / 2 },
    { key: 'voice', label: 'Tom de voz & personalidade', value: ((filled(profile.toneOfVoice) ? 1 : 0) + (filled(profile.brandPersonality) ? 1 : 0)) / 2 },
    { key: 'audience', label: 'Público & CTA', value: ((filled(profile.targetAudience) ? 1 : 0) + (filled(profile.defaultCta) ? 1 : 0)) / 2 },
    { key: 'personas', label: 'Personas mapeadas', value: Math.min(counts.personas / 2, 1) },
    { key: 'rules', label: 'Regras DO / DONT', value: Math.min(counts.rules / 4, 1) },
    { key: 'pillars', label: 'Pilares de conteúdo', value: Math.min(counts.pillars / 3, 1) },
    { key: 'colors', label: 'Cores & referências', value: Math.min(counts.colors / 3, 1) },
  ]
  const score = Math.round((modules.reduce((sum, m) => sum + m.value, 0) / modules.length) * 100)
  const level = score >= 85 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 30 ? 'Em construção' : 'Inicial'
  const missing = modules.filter((m) => m.value < 1 && CALIBRATION_TABS[m.key]).slice(0, 2)

  return (
    <aside className="space-y-5 rounded-[20px] border border-border/70 bg-card p-5 shadow-card sm:p-6 xl:sticky xl:top-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark dark:text-primary-light"><Brain size={21} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">Brand Brain</p>
          <p className="text-[13px] text-muted-foreground">Memória desta marca</p>
        </div>
        <Badge dot variant={score >= 60 ? 'success' : 'warning'}>{score >= 60 ? 'Calibrado' : 'Aprendendo'}</Badge>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-foreground/85">Nível de calibração</span>
          <span className="text-2xl font-bold tabular-nums text-primary-dark dark:text-primary-light">{score}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/70">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${score}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Qualidade estimada: <span className="font-semibold text-foreground">{level}</span></p>
      </div>

      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Status dos módulos</p>
        <ul className="space-y-2.5">
          {modules.map((m) => {
            const pct = Math.round(m.value * 100)
            return (
              <li key={m.key} className="flex items-center gap-2.5 text-sm">
                {pct === 100 ? <CheckCircle2 size={16} className="shrink-0 text-success" /> : pct > 0 ? <CircleDashed size={16} className="shrink-0 text-warning" /> : <AlertTriangle size={16} className="shrink-0 text-error" />}
                <span className="min-w-0 flex-1 truncate text-foreground/85">{m.label}</span>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{pct}%</span>
              </li>
            )
          })}
        </ul>
      </div>

      {missing.length > 0 && (
        <div className="space-y-2.5 border-t border-border/70 pt-5">
          <p className="text-sm font-semibold text-foreground">Próximos passos sugeridos</p>
          {missing.map((m) => (
            <button key={m.key} type="button" onClick={() => onOpenTab(CALIBRATION_TABS[m.key])}
              className="group block w-full rounded-xl border border-border/70 p-3.5 text-left transition-colors hover:border-grey-400 hover:bg-muted/40">
              <span className="block text-[13px] font-medium text-foreground">Completar “{m.label}”</span>
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-dark dark:text-primary-light">Preencher agora <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" /></span>
            </button>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-info/[0.06] p-3 text-xs leading-relaxed text-foreground/75">
        <Info size={14} className="mt-0.5 shrink-0 text-info-dark dark:text-info" />
        Quanto maior a calibração, mais assertivas são as legendas e os planos gerados para este cliente.
      </p>
    </aside>
  )
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const referenceFileInputRef = useRef<HTMLInputElement>(null)
  const [client, setClient] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('brand')
  const [loading, setLoading] = useState(true)

  // Brand sub-data
  const [profile, setProfile] = useState<any>({})
  const [rules, setRules] = useState<any[]>([])
  const [colors, setColors] = useState<any[]>([])
  const [referenceImages, setReferenceImages] = useState<any[]>([])
  const [uploadingReferenceImage, setUploadingReferenceImage] = useState(false)
  const [pillars, setPillars] = useState<any[]>([])
  const [personas, setPersonas] = useState<any[]>([])
  const [feedbackList, setFeedbackList] = useState<any[]>([])

  // AI Generation State
  const [analyzingBrand, setAnalyzingBrand] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)

  // Contact info (email/phone/website) — edited inline, separate from the brand-profile tabs
  const [editingContact, setEditingContact] = useState(false)
  const [contactForm, setContactForm] = useState({ email: '', phone: '', website: '' })
  const [savingContact, setSavingContact] = useState(false)

  // Forms
  const [newRule, setNewRule] = useState({ ruleType: 'DO', ruleText: '', importance: 8 })
  const [newColor, setNewColor] = useState({ name: '', hex: '#00A76F', usageNotes: 'Destaque / Accent' })
  const [newPillar, setNewPillar] = useState({ name: '', description: '', percentageTarget: 25 })
  const [newPersona, setNewPersona] = useState({ name: '', ageRange: '', description: '' })
  const [newFeedback, setNewFeedback] = useState({ feedbackText: '', isGlobalRule: true })
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null)
  const [editingFeedbackText, setEditingFeedbackText] = useState('')

  const loadData = async () => {
    try {
      const [cRes, profRes, rulesRes, colorsRes, pillarsRes, personasRes, fbRes, refImgRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get(`/brand/clients/${id}/profile`),
        api.get(`/brand/clients/${id}/rules`),
        api.get(`/brand/clients/${id}/colors`),
        api.get(`/brand/clients/${id}/pillars`),
        api.get(`/brand/clients/${id}/personas`),
        api.get(`/brand/clients/${id}/feedback`),
        api.get(`/brand/clients/${id}/reference-images`),
      ])
      setClient(cRes.data)
      setContactForm({ email: cRes.data.email || '', phone: cRes.data.phone || '', website: cRes.data.website || '' })
      setProfile(profRes.data || {})
      setRules(rulesRes.data || [])
      setColors(colorsRes.data || [])
      setPillars(pillarsRes.data || [])
      setPersonas(personasRes.data || [])
      setFeedbackList(fbRes.data || [])
      setReferenceImages(refImgRes.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingContact(true)
    try {
      const { data } = await api.patch(`/clients/${id}`, contactForm)
      setClient(data)
      setEditingContact(false)
    } catch (err) {
      toast.error('Erro ao salvar os dados de contato', getErrorMessage(err))
    } finally {
      setSavingContact(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.patch(`/brand/clients/${id}/profile`, profile)
      toast.success('Perfil de marca salvo!')
    } catch (err) {
      toast.error('Erro ao atualizar perfil', getErrorMessage(err))
    }
  }

  const handleUploadReferenceImage = async (file: File) => {
    setUploadingReferenceImage(true)
    try {
      const uploaded = await uploadFile(file) as any
      const { data } = await api.post(`/brand/clients/${id}/reference-images`, {
        publicUrl: uploaded.publicUrl,
        storageKey: uploaded.storageKey,
      })
      setReferenceImages([data, ...referenceImages])
    } catch (err) {
      toast.error('Erro ao enviar a imagem de referência', getErrorMessage(err))
    } finally {
      setUploadingReferenceImage(false)
    }
  }

  const handleDeleteReferenceImage = async (imageId: string) => {
    if (!(await confirmDialog({ title: 'Remover imagem de referência?', description: 'O Brand Brain deixa de usar esta imagem como referência visual da marca.', variant: 'destructive', confirmLabel: 'Remover' }))) return
    try {
      await api.delete(`/brand/clients/${id}/reference-images/${imageId}`)
      setReferenceImages(referenceImages.filter((r) => r.id !== imageId))
    } catch (err) {
      toast.error('Erro ao remover a imagem', getErrorMessage(err))
    }
  }

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRule.ruleText) return
    try {
      const { data } = await api.post(`/brand/clients/${id}/rules`, newRule)
      setRules([...rules, data])
      setNewRule({ ruleType: 'DO', ruleText: '', importance: 8 })
    } catch (err) {
      toast.error('Erro ao adicionar regra', getErrorMessage(err))
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await api.delete(`/brand/clients/${id}/rules/${ruleId}`)
      setRules(rules.filter((r) => r.id !== ruleId))
    } catch (err) {
      toast.error('Erro ao excluir regra', getErrorMessage(err))
    }
  }

  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newColor.name || !newColor.hex) return
    try {
      const { data } = await api.post(`/brand/clients/${id}/colors`, newColor)
      setColors([...colors, data])
      setNewColor({ name: '', hex: '#00A76F', usageNotes: 'Destaque / Accent' })
    } catch (err) {
      toast.error('Erro ao adicionar cor', getErrorMessage(err))
    }
  }

  const handleDeleteColor = async (colorId: string) => {
    try {
      await api.delete(`/brand/clients/${id}/colors/${colorId}`)
      setColors(colors.filter((c) => c.id !== colorId))
    } catch (err) {
      toast.error('Erro ao excluir cor', getErrorMessage(err))
    }
  }

  const handleAddPillar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPillar.name) return
    try {
      const { data } = await api.post(`/brand/clients/${id}/pillars`, newPillar)
      setPillars([...pillars, data])
      setNewPillar({ name: '', description: '', percentageTarget: 25 })
    } catch (err) {
      toast.error('Erro ao adicionar pilar', getErrorMessage(err))
    }
  }

  const handleAddPersona = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPersona.name) return
    try {
      const { data } = await api.post(`/brand/clients/${id}/personas`, newPersona)
      setPersonas([...personas, data])
      setNewPersona({ name: '', ageRange: '', description: '' })
    } catch (err) {
      toast.error('Erro ao adicionar persona', getErrorMessage(err))
    }
  }

  const handleDeletePersona = async (personaId: string) => {
    if (!(await confirmDialog({ title: 'Remover esta persona?', description: 'Os próximos conteúdos gerados deixam de considerar este público.', variant: 'destructive', confirmLabel: 'Remover' }))) return
    try {
      await api.delete(`/brand/clients/${id}/personas/${personaId}`)
      setPersonas(personas.filter((p) => p.id !== personaId))
    } catch (err) {
      toast.error('Erro ao remover persona', getErrorMessage(err))
    }
  }

  const handleAddFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFeedback.feedbackText) return
    try {
      const { data } = await api.post(`/brand/clients/${id}/feedback`, {
        feedbackText: newFeedback.feedbackText,
        isGlobalRule: newFeedback.isGlobalRule,
        normalizedInstruction: newFeedback.feedbackText,
      })
      setFeedbackList([data, ...feedbackList])
      setNewFeedback({ feedbackText: '', isGlobalRule: true })
      loadData()
    } catch (err) {
      toast.error('Erro ao registrar feedback', getErrorMessage(err))
    }
  }

  const handleStartEditFeedback = (fb: any) => {
    setEditingFeedbackId(fb.id)
    setEditingFeedbackText(fb.feedbackText)
  }

  const handleSaveEditFeedback = async (feedbackId: string) => {
    if (!editingFeedbackText.trim()) return
    try {
      const { data } = await api.patch(`/brand/clients/${id}/feedback/${feedbackId}`, { feedbackText: editingFeedbackText.trim() })
      setFeedbackList(feedbackList.map((fb) => (fb.id === feedbackId ? data : fb)))
      setEditingFeedbackId(null)
    } catch (err) {
      toast.error('Erro ao salvar o feedback', getErrorMessage(err))
    }
  }

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!(await confirmDialog({ title: 'Apagar este feedback da memória?', description: 'O Brand Brain esquece este aprendizado. Essa ação não pode ser desfeita.', variant: 'destructive', confirmLabel: 'Apagar' }))) return
    try {
      await api.delete(`/brand/clients/${id}/feedback/${feedbackId}`)
      setFeedbackList(feedbackList.filter((fb) => fb.id !== feedbackId))
    } catch (err) {
      toast.error('Erro ao apagar o feedback', getErrorMessage(err))
    }
  }

  const handleUploadLogo = async (file: File) => {
    try {
      const { publicUrl } = await uploadFile(file, { clientId: id! })
      const { data } = await api.patch(`/clients/${id}`, { logoUrl: publicUrl })
      setClient({ ...client, logoUrl: data.logoUrl })
    } catch (err) {
      toast.error('Erro ao enviar o logotipo do cliente', getErrorMessage(err))
    }
  }

  const handleAIBrandAnalysis = async () => {
    setAnalyzingBrand(true)
    try {
      const { data } = await api.post('/ai/analyze-brand', { clientId: id })
      setAiResult(data)

      // The AI returns a full brand profile in one shot — persist all of it, not just show it
      // locally: profile fields, personas, content pillars and DO/DONT rules. Re-running the
      // analysis appends new personas/pillars/rules rather than replacing existing ones, same
      // as adding them manually would.
      const updatedProfile = {
        ...profile,
        brandSummary: data.brandSummary || profile.brandSummary,
        positioning: data.positioning || profile.positioning,
        targetAudience: data.targetAudience || profile.targetAudience,
        toneOfVoice: data.toneOfVoice || profile.toneOfVoice,
        brandPersonality: data.brandPersonality || profile.brandPersonality,
        defaultCta: profile.defaultCta || data.recommendedCtas?.[0],
      }
      await api.patch(`/brand/clients/${id}/profile`, updatedProfile)

      const pillarCount = data.contentPillars?.length || 0
      const evenSplit = pillarCount ? Math.round(100 / pillarCount) : 0
      await Promise.all([
        ...(data.personas || []).map((p: any) => api.post(`/brand/clients/${id}/personas`, {
          name: p.name, ageRange: p.ageRange, description: p.description, painPoints: p.painPoints, goals: p.goals,
        })),
        ...(data.contentPillars || []).map((name: string) => api.post(`/brand/clients/${id}/pillars`, {
          name, description: '', percentageTarget: evenSplit,
        })),
        ...(data.brandRules || []).map((r: any) => api.post(`/brand/clients/${id}/rules`, {
          ruleType: r.ruleType, ruleText: r.ruleText, source: 'AI_ANALYSIS', importance: 7,
        })),
      ])

      await loadData()
      toast.success(
        'Análise de marca aplicada!',
        `${data.personas?.length || 0} personas, ${pillarCount} pilares e ${data.brandRules?.length || 0} regras adicionadas — confira nas outras abas.`
      )
    } catch (err) {
      toast.error('Erro ao rodar análise do Brand Brain', getErrorMessage(err))
    } finally {
      setAnalyzingBrand(false)
    }
  }

  if (loading) {
    return (
      <Page>
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </Page>
    )
  }

  return (
    <Page>
      <Link to="/app/clients" className="hidden items-center gap-1.5 text-sm font-medium lg:inline-flex text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft size={16} aria-hidden />Voltar para Clientes
      </Link>

      <section className="flex flex-col gap-5 rounded-[20px] border border-border/70 bg-card p-5 shadow-card sm:p-6 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <UploadableAvatar
            src={client.logoUrl}
            rounded="rounded-full"
            className="size-16 shrink-0 bg-primary/10"
            fallback={<span className="text-xl font-bold text-primary-dark dark:text-primary-light">{getInitials(client.name)}</span>}
            onUpload={handleUploadLogo}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-[26px] font-bold tracking-[-0.02em] text-foreground">{client.name}</h1>
              <Badge dot variant={client.status === 'ACTIVE' ? 'success' : client.status === 'PAUSED' ? 'warning' : 'default'}>{client.status === 'ACTIVE' ? 'Ativo' : client.status === 'PAUSED' ? 'Pausado' : client.status}</Badge>
            </div>
            <Meta className="mt-1.5 text-sm" items={[
              client.industry || 'Setor não informado',
              `Cliente desde ${new Date(client.createdAt).toLocaleDateString('pt-BR')}`,
              client.accountManager?.name && `Gestor: ${client.accountManager.name}`,
            ]} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild variant="outline"><Link to="/app/content/calendar" state={{ clientId: client.id }}><CalendarRange size={16} aria-hidden />Planner do cliente</Link></Button>
          <Button onClick={handleAIBrandAnalysis} loading={analyzingBrand}>
            {analyzingBrand ? <span>Analisando…</span> : <><Sparkles size={16} /><span>Análise de marca com Brand Brain</span></>}
          </Button>
        </div>
      </section>

      {/* Contact Info — email/phone (WhatsApp) used for approval-request notifications */}
      <Card className={editingContact ? 'space-y-3 rounded-[20px]' : 'rounded-[20px] px-5 py-4'}>
        {editingContact && (
          <h3 className="text-[15px] font-bold tracking-tight text-foreground">Dados de contato</h3>
        )}

        {editingContact ? (
          <form onSubmit={handleSaveContact} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="contactEmail" className="flex items-center gap-1.5"><Mail size={13} className="text-muted-foreground" />Email</Label>
                <Input id="contactEmail" type="email" placeholder="contato@marca.com.br" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="contactPhone" className="flex items-center gap-1.5"><Phone size={13} className="text-muted-foreground" />Telefone / WhatsApp</Label>
                <Input id="contactPhone" type="text" placeholder="+55 11 99999-0000" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="contactWebsite" className="flex items-center gap-1.5"><Globe size={13} className="text-muted-foreground" />Website</Label>
                <Input id="contactWebsite" type="text" placeholder="https://marca.com.br" value={contactForm.website} onChange={(e) => setContactForm({ ...contactForm, website: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" loading={savingContact}>
                {!savingContact && <span>Salvar</span>}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingContact(false); setContactForm({ email: client.email || '', phone: client.phone || '', website: client.website || '' }) }}>
                <X size={13} />
                <span>Cancelar</span>
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3 text-sm lg:flex-row lg:items-center lg:gap-0 lg:divide-x lg:divide-border/70">
            <div className="flex min-w-0 items-center gap-2 lg:flex-1 lg:pr-5">
              <Mail size={16} className="shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-muted-foreground">Email:</span>
              {client.email ? <span className="truncate font-semibold text-foreground">{client.email}</span> : <span className="italic text-muted-foreground">não cadastrado</span>}
            </div>
            <div className="flex min-w-0 items-center gap-2 lg:flex-1 lg:px-5" title={client.phone ? undefined : 'Necessário para enviar aprovações por WhatsApp'}>
              <Phone size={16} className="shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-muted-foreground">WhatsApp:</span>
              {client.phone ? <span className="truncate font-semibold text-foreground">{client.phone}</span> : <span className="italic text-warning-dark dark:text-warning">não cadastrado</span>}
            </div>
            <div className="flex min-w-0 items-center gap-2 lg:flex-1 lg:px-5">
              <Globe size={16} className="shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-muted-foreground">Website:</span>
              {client.website ? <span className="truncate font-semibold text-foreground">{client.website}</span> : <span className="italic text-muted-foreground">não cadastrado</span>}
            </div>
            <div className="lg:pl-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingContact(true)}>
                <Pencil size={13} />
                <span>Editar</span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* AI Suggestion Banner */}
      {aiResult && (
        <Card className="space-y-3 animate-fade-in bg-primary/5 border-primary/15">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-bold text-xs">
              <Sparkles size={16} />
              <span>Insights Gerados pelo Brand Brain para {client.name}</span>
            </div>
            <Button
              variant="ghost"
              onClick={() => setAiResult(null)}
              className="h-auto p-0 font-medium normal-case text-muted-foreground hover:text-foreground hover:bg-transparent"
            >
              Fechar
            </Button>
          </div>
          <p className="text-xs text-foreground font-semibold leading-relaxed">
            "{aiResult.brandSummary}"
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
            <div className="bg-card p-3.5 rounded-xl border border-border">
              <span className="font-bold text-primary block mb-1">Público-Alvo:</span>
              <span className="text-foreground/80">{aiResult.targetAudience}</span>
            </div>
            <div className="bg-card p-3.5 rounded-xl border border-border">
              <span className="font-bold text-primary block mb-1">Tom de voz:</span>
              <span className="text-foreground/80">{aiResult.toneOfVoice}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Minimals Tabs */}
      <div role="tablist" aria-label="Brand Brain do cliente" className="-mx-4 flex items-center gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {TABS.map((tab) => {
          const count = ({ personas: personas.length, rules: rules.length, pillars: pillars.length, colors: colors.length + referenceImages.length, feedback: feedbackList.length } as Record<string, number>)[tab.id]
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3.5 text-sm font-semibold transition-colors ${
                active ? 'border-primary text-primary-dark dark:text-primary-light' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
              {count !== undefined && count > 0 && (
                <span className={`rounded-md px-1.5 py-px text-[11px] tabular-nums ${active ? 'bg-primary/10' : 'bg-muted'}`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* TAB 1: Brand Profile */}
      {activeTab === 'brand' && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={handleUpdateProfile} className="space-y-6 rounded-[20px] border border-border/70 bg-card p-5 shadow-card sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-5">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Diretrizes fundamentais da marca</h2>
              <p className="mt-1 text-sm text-muted-foreground">Informações que o Brand Brain usa para calibrar legendas, roteiros e estratégias.</p>
            </div>
            <Button type="submit">Salvar alterações</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <Label htmlFor="brandSummary">Resumo da marca (Brand summary)</Label>
              <Textarea
                id="brandSummary"
                rows={5}
                className="resize-y min-h-[6rem]"
                value={profile.brandSummary || ''}
                onChange={(e) => setProfile({ ...profile, brandSummary: e.target.value })}
                placeholder="Ex: Bella Moda é uma marca de moda feminina premium focada em peças atemporais…"
              />
            </div>

            <div>
              <Label htmlFor="toneOfVoice">Tom de voz</Label>
              <Textarea
                id="toneOfVoice"
                rows={2}
                className="resize-y"
                value={profile.toneOfVoice || ''}
                onChange={(e) => setProfile({ ...profile, toneOfVoice: e.target.value })}
                placeholder="Ex: Elegante, próximo, inspirador, empoderador"
              />
            </div>

            <div>
              <Label htmlFor="positioning">Posicionamento</Label>
              <Textarea
                id="positioning"
                rows={2}
                className="resize-y"
                value={profile.positioning || ''}
                onChange={(e) => setProfile({ ...profile, positioning: e.target.value })}
                placeholder="Ex: Premium acessível para mulheres modernas"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="targetAudience">Público-Alvo</Label>
              <Textarea
                id="targetAudience"
                rows={2}
                className="resize-y"
                value={profile.targetAudience || ''}
                onChange={(e) => setProfile({ ...profile, targetAudience: e.target.value })}
                placeholder="Ex: Mulheres de 28 a 45 anos, classe A/B que valorizam qualidade e sofisticação"
              />
            </div>

            <div>
              <Label htmlFor="defaultCta">CTA padrão recomendada</Label>
              <Input
                id="defaultCta"
                type="text"
                value={profile.defaultCta || ''}
                onChange={(e) => setProfile({ ...profile, defaultCta: e.target.value })}
                placeholder="Ex: Descubra a nova coleção no link da bio"
              />
            </div>

            <div>
              <Label htmlFor="brandPersonality">Personalidade da marca</Label>
              <Input
                id="brandPersonality"
                type="text"
                value={profile.brandPersonality || ''}
                onChange={(e) => setProfile({ ...profile, brandPersonality: e.target.value })}
                placeholder="Ex: Autêntica, acolhedora, sofisticada"
              />
            </div>
          </div>
        </form>
        <BrandBrainCalibration
          profile={profile}
          counts={{ personas: personas.length, rules: rules.length, pillars: pillars.length, colors: colors.length + referenceImages.length, feedback: feedbackList.length }}
          onOpenTab={setActiveTab}
        />
        </div>
      )}

      {/* TAB: Personas */}
      {activeTab === 'personas' && (
        <div className="space-y-6">
          <div className="card-minimals p-6">
            <h2 className="mb-1 text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">Personas do público</h2>
            <p className="text-xs text-muted-foreground font-medium mb-4">
              Perfis de cliente ideal usados pelo Brand Brain para escrever com a linguagem certa pra cada público.
            </p>

            <form onSubmit={handleAddPersona} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                type="text"
                required
                placeholder="Nome (Ex: Ana — A Profissional)"
                value={newPersona.name}
                onChange={(e) => setNewPersona({ ...newPersona, name: e.target.value })}
              />
              <Input
                type="text"
                placeholder="Faixa etária (Ex: 28-38)"
                value={newPersona.ageRange}
                onChange={(e) => setNewPersona({ ...newPersona, ageRange: e.target.value })}
              />
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Descrição curta"
                  value={newPersona.description}
                  onChange={(e) => setNewPersona({ ...newPersona, description: e.target.value })}
                  className="flex-1"
                />
                <Button type="submit" className="shrink-0 gap-1.5">
                  <Plus size={16} />
                  <span>Adicionar</span>
                </Button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personas.map((persona) => (
              <div key={persona.id} className="card-minimals-hover p-5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-xs text-grey-800">{persona.name}</h3>
                    {persona.ageRange && <p className="text-[11px] text-grey-500 font-medium">{persona.ageRange}</p>}
                  </div>
                  <button
                    onClick={() => handleDeletePersona(persona.id)}
                    className="p-1 text-muted-foreground hover:text-error rounded-md transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {persona.description && <p className="text-xs text-grey-600 font-medium">{persona.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Rules */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="card-minimals p-6">
            <h2 className="mb-1 text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">Regras obrigatórias da marca</h2>
            <p className="text-xs text-muted-foreground font-medium mb-4">
              O Brand Brain nunca violará essas regras ao redigir legendas, hooks ou planejar posts.
            </p>

            <form onSubmit={handleAddRule} className="flex flex-col sm:flex-row gap-3">
              <div className="sm:w-56">
                <Select value={newRule.ruleType} onValueChange={(v) => setNewRule({ ...newRule, ruleType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DO">DO (Sempre Fazer)</SelectItem>
                    <SelectItem value="DONT">DONT (Nunca Fazer)</SelectItem>
                    <SelectItem value="TONE">Tom de voz</SelectItem>
                    <SelectItem value="COPY">Regra de copy</SelectItem>
                    <SelectItem value="CTA">Regra de CTA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Input
                type="text"
                required
                placeholder="Ex: Nunca usar gírias excessivas / Sempre incluir CTA para o WhatsApp…"
                value={newRule.ruleText}
                onChange={(e) => setNewRule({ ...newRule, ruleText: e.target.value })}
                className="flex-1"
              />

              <Button type="submit" className="shrink-0">
                <Plus size={16} />
                <span>Adicionar regra</span>
              </Button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="card-minimals-hover p-5 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <Badge variant={rule.ruleType === 'DONT' ? 'error' : 'success'}>{rule.ruleType}</Badge>
                  <div>
                    <p className="text-xs font-bold text-grey-800">{rule.ruleText}</p>
                    <p className="text-[11px] text-grey-500 font-medium mt-1">Origem: {rule.source} • Importância: {rule.importance}/10</p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteRule(rule.id)}
                  className="h-auto w-auto p-1 text-muted-foreground hover:text-error hover:bg-transparent"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Pillars */}
      {activeTab === 'pillars' && (
        <div className="space-y-6">
          <div className="card-minimals p-6">
            <h2 className="mb-1 text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">Pilares editoriais de conteúdo</h2>
            <p className="text-xs text-muted-foreground font-medium mb-4">
              Distribuição temática para o gerador de calendário do Brand Brain.
            </p>

            <form onSubmit={handleAddPillar} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                type="text"
                required
                placeholder="Nome do Pilar (Ex: Educação)"
                value={newPillar.name}
                onChange={(e) => setNewPillar({ ...newPillar, name: e.target.value })}
              />

              <Input
                type="text"
                placeholder="Descrição (Ex: Tendências e dicas)"
                value={newPillar.description}
                onChange={(e) => setNewPillar({ ...newPillar, description: e.target.value })}
              />

              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="% Alvo"
                  value={newPillar.percentageTarget}
                  onChange={(e) => setNewPillar({ ...newPillar, percentageTarget: Number(e.target.value) })}
                  className="w-24"
                />
                <Button type="submit" className="flex-1 justify-center gap-1.5">
                  <Plus size={16} />
                  <span>Adicionar</span>
                </Button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pillars.map((pillar) => (
              <div key={pillar.id} className="card-minimals-hover p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-grey-800">{pillar.name}</h3>
                  <Badge variant="primary">{pillar.percentageTarget ? `${pillar.percentageTarget}%` : 'Sem %'}</Badge>
                </div>
                <p className="text-xs text-grey-500 font-medium">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Colors */}
      {activeTab === 'colors' && (
        <div className="space-y-6">
          <form onSubmit={handleUpdateProfile} className="card-minimals p-6 space-y-3">
            <div>
              <h2 className="mb-1 text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">Estilo visual</h2>
              <p className="text-xs text-muted-foreground font-medium">
                Descreva em texto livre o estilo que o Brand Brain deve seguir ao gerar imagens — mood, composição, iconografia, fundo, etc. Isso é usado diretamente no prompt de geração.
              </p>
            </div>
            <Textarea
              rows={3}
              placeholder='Ex: "Minimalista, fundo bege/creme, tipografia preta em negrito, ícones 3D dourados, muito espaço em branco."'
              value={profile.visualStyleDescription || ''}
              onChange={(e) => setProfile({ ...profile, visualStyleDescription: e.target.value })}
            />
            <Button type="submit" size="sm">Salvar estilo visual</Button>
          </form>

          <div className="card-minimals p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="mb-1 text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">Referências visuais</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Exemplos de posts/criativos que representam o estilo desejado — use como mood board.
                </p>
              </div>
              <input
                ref={referenceFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadReferenceImage(f); e.target.value = '' }}
              />
              <Button
                type="button" variant="outline" size="sm" className="shrink-0"
                disabled={uploadingReferenceImage}
                onClick={() => referenceFileInputRef.current?.click()}
              >
                {uploadingReferenceImage ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                <span>Adicionar referência</span>
              </Button>
            </div>

            {referenceImages.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma referência visual adicionada ainda.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {referenceImages.map((img) => (
                  <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border aspect-square">
                    <img src={img.publicUrl} alt={img.note || 'Referência visual'} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleDeleteReferenceImage(img.id)}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-minimals p-6">
            <h2 className="mb-1 text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">Paleta de cores</h2>
            <p className="text-xs text-muted-foreground font-medium mb-4">Cores oficiais da marca para direção criativa.</p>

            <form onSubmit={handleAddColor} className="flex flex-wrap gap-3">
              <input
                type="color"
                value={newColor.hex}
                onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })}
                className="w-12 h-10 bg-transparent border-0 rounded-xl cursor-pointer shrink-0"
              />
              <Input
                type="text"
                required
                placeholder="Nome da cor (Ex: Dourado Principal)"
                value={newColor.name}
                onChange={(e) => setNewColor({ ...newColor, name: e.target.value })}
                className="flex-1 min-w-[160px]"
              />
              <Input
                type="text"
                value={newColor.hex}
                onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })}
                className="w-28 uppercase font-mono"
              />
              <div className="w-full sm:w-48">
                <Select value={newColor.usageNotes} onValueChange={(v) => setNewColor({ ...newColor, usageNotes: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fundo">Fundo</SelectItem>
                    <SelectItem value="Texto">Texto</SelectItem>
                    <SelectItem value="Destaque / Accent">Destaque / accent</SelectItem>
                    <SelectItem value="Botão / CTA">Botão / CTA</SelectItem>
                    <SelectItem value="Ícones / Bordas">Ícones / bordas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full sm:w-auto">Salvar cor</Button>
            </form>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {colors.map((color) => (
              <div key={color.id} className="card-minimals-hover p-4 space-y-3">
                <div
                  className="w-full h-16 rounded-xl border border-black/5 shadow-inner"
                  style={{ backgroundColor: color.hex }}
                />
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">{color.name}</h4>
                    <span className="text-[11px] font-mono text-muted-foreground uppercase">{color.hex}</span>
                    {color.usageNotes && (
                      <span className="block text-[11px] text-muted-foreground font-semibold mt-0.5 truncate">{color.usageNotes}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteColor(color.id)}
                    className="h-auto w-auto p-1 text-muted-foreground hover:text-error hover:bg-transparent shrink-0"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Feedback Memory */}
      {activeTab === 'feedback' && (
        <div className="space-y-6">
          <div className="card-minimals p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground sm:text-[17px]">Aprendizagem por feedback</h2>
              <p className="text-xs text-muted-foreground font-medium">
                Feedbacks recebidos nas aprovações viram regras permanentes do Brand Brain.
              </p>
            </div>

            <form onSubmit={handleAddFeedback} className="space-y-3">
              <Textarea
                rows={2}
                required
                value={newFeedback.feedbackText}
                onChange={(e) => setNewFeedback({ ...newFeedback, feedbackText: e.target.value })}
                placeholder="Ex: O cliente pediu para nunca mais usar a palavra 'barato', e sim 'acessível'..."
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-grey-600 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFeedback.isGlobalRule}
                    onChange={(e) => setNewFeedback({ ...newFeedback, isGlobalRule: e.target.checked })}
                    className="rounded border-grey-300 text-primary focus:ring-primary shrink-0"
                  />
                  <span>Transformar em regra permanente no Brand Brain</span>
                </label>
                <Button type="submit" className="w-full sm:w-auto justify-center">
                  <Send size={15} />
                  <span>Gravar na memória</span>
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-3">
            {feedbackList.map((fb) => (
              <div key={fb.id} className="card-minimals p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="info">{fb.category || 'Geral'}</Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-grey-400 font-medium">{new Date(fb.createdAt).toLocaleDateString('pt-BR')}</span>
                    {editingFeedbackId !== fb.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEditFeedback(fb)}
                          className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFeedback(fb.id)}
                          className="p-1 text-muted-foreground hover:text-error rounded-md transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editingFeedbackId === fb.id ? (
                  <div className="space-y-2">
                    <Textarea
                      rows={2}
                      value={editingFeedbackText}
                      onChange={(e) => setEditingFeedbackText(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={() => handleSaveEditFeedback(fb.id)}>Salvar</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingFeedbackId(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-grey-800">"{fb.feedbackText}"</p>
                )}

                {fb.isGlobalRule && (
                  <Badge variant="success" className="flex items-center gap-1 w-fit normal-case">
                    <CheckCircle2 size={12} />
                    Regra ativa no Brand Brain
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Page>
  )
}
