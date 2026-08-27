import React, { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Sparkles, Plus, Trash2,
  CheckCircle2, ArrowLeft, Send, Mail, Phone, Globe, Pencil, X, ImagePlus, Loader2,
  Brain, Shield, BarChart3, Palette, MessageCircle,
} from 'lucide-react'
import api from '@/lib/api'
import { uploadFile } from '@/lib/upload'
import { getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { UploadableAvatar } from '@/components/ui/UploadableAvatar'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'

const TABS = [
  { id: 'brand', label: 'Perfil & Identidade', icon: Brain },
  { id: 'rules', label: 'Regras da Marca (DO / DONT)', icon: Shield },
  { id: 'pillars', label: 'Pilares de Conteúdo', icon: BarChart3 },
  { id: 'colors', label: 'Cores, Estilo & Referências', icon: Palette },
  { id: 'feedback', label: 'Memória de Feedback', icon: MessageCircle },
]

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
  const [newFeedback, setNewFeedback] = useState({ feedbackText: '', isGlobalRule: true })
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null)
  const [editingFeedbackText, setEditingFeedbackText] = useState('')

  const loadData = async () => {
    try {
      const [cRes, profRes, rulesRes, colorsRes, pillarsRes, fbRes, refImgRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get(`/brand/clients/${id}/profile`),
        api.get(`/brand/clients/${id}/rules`),
        api.get(`/brand/clients/${id}/colors`),
        api.get(`/brand/clients/${id}/pillars`),
        api.get(`/brand/clients/${id}/feedback`),
        api.get(`/brand/clients/${id}/reference-images`),
      ])
      setClient(cRes.data)
      setContactForm({ email: cRes.data.email || '', phone: cRes.data.phone || '', website: cRes.data.website || '' })
      setProfile(profRes.data || {})
      setRules(rulesRes.data || [])
      setColors(colorsRes.data || [])
      setPillars(pillarsRes.data || [])
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
      alert('Erro ao salvar os dados de contato.')
    } finally {
      setSavingContact(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.patch(`/brand/clients/${id}/profile`, profile)
      alert('Perfil de marca salvo!')
    } catch (err) {
      alert('Erro ao atualizar perfil.')
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
      alert('Erro ao enviar a imagem de referência.')
    } finally {
      setUploadingReferenceImage(false)
    }
  }

  const handleDeleteReferenceImage = async (imageId: string) => {
    if (!confirm('Remover esta imagem de referência?')) return
    try {
      await api.delete(`/brand/clients/${id}/reference-images/${imageId}`)
      setReferenceImages(referenceImages.filter((r) => r.id !== imageId))
    } catch (err) {
      alert('Erro ao remover a imagem.')
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
      alert('Erro ao adicionar regra.')
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await api.delete(`/brand/clients/${id}/rules/${ruleId}`)
      setRules(rules.filter((r) => r.id !== ruleId))
    } catch (err) {
      alert('Erro ao excluir regra.')
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
      alert('Erro ao adicionar cor.')
    }
  }

  const handleDeleteColor = async (colorId: string) => {
    try {
      await api.delete(`/brand/clients/${id}/colors/${colorId}`)
      setColors(colors.filter((c) => c.id !== colorId))
    } catch (err) {
      alert('Erro ao excluir cor.')
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
      alert('Erro ao adicionar pilar.')
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
      alert('Erro ao registrar feedback.')
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
      alert('Erro ao salvar o feedback.')
    }
  }

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!confirm('Apagar este feedback da memória?')) return
    try {
      await api.delete(`/brand/clients/${id}/feedback/${feedbackId}`)
      setFeedbackList(feedbackList.filter((fb) => fb.id !== feedbackId))
    } catch (err) {
      alert('Erro ao apagar o feedback.')
    }
  }

  const handleUploadLogo = async (file: File) => {
    try {
      const { publicUrl } = await uploadFile(file, { clientId: id! })
      const { data } = await api.patch(`/clients/${id}`, { logoUrl: publicUrl })
      setClient({ ...client, logoUrl: data.logoUrl })
    } catch {
      alert('Erro ao enviar o logotipo do cliente.')
    }
  }

  const handleAIBrandAnalysis = async () => {
    setAnalyzingBrand(true)
    try {
      const { data } = await api.post('/ai/analyze-brand', { clientId: id })
      setAiResult(data)
      setProfile({
        ...profile,
        brandSummary: data.brandSummary || profile.brandSummary,
        positioning: data.positioning || profile.positioning,
        targetAudience: data.targetAudience || profile.targetAudience,
        toneOfVoice: data.toneOfVoice || profile.toneOfVoice,
      })
    } catch (err) {
      alert('Erro ao rodar análise de IA.')
    } finally {
      setAnalyzingBrand(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8 space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app/clients">
              <ArrowLeft size={20} />
            </Link>
          </Button>
          <div className="flex items-center gap-3.5">
            <UploadableAvatar
              src={client.logoUrl}
              rounded="rounded-2xl"
              className="w-14 h-14 bg-primary/10"
              fallback={<span className="text-primary-dark font-extrabold text-lg">{getInitials(client.name)}</span>}
              onUpload={handleUploadLogo}
            />
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
                {client.name}
              </h1>
              <p className="text-xs text-muted-foreground font-medium">{client.industry || 'Setor não informado'} • Criado em {new Date(client.createdAt).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

        <Button onClick={handleAIBrandAnalysis} loading={analyzingBrand} className="self-start">
          {!analyzingBrand && (
            <>
              <Sparkles size={16} />
              <span>Análise de Marca com IA</span>
            </>
          )}
          {analyzingBrand && <span>Analisando...</span>}
        </Button>
      </div>

      {/* Contact Info — email/phone (WhatsApp) used for approval-request notifications */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider">Dados de Contato</h3>
          {!editingContact && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingContact(true)}>
              <Pencil size={13} />
              <span>Editar</span>
            </Button>
          )}
        </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-muted-foreground shrink-0" />
              {client.email ? <span className="text-foreground font-semibold truncate">{client.email}</span> : <span className="text-muted-foreground italic">Email não cadastrado</span>}
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-muted-foreground shrink-0" />
              {client.phone ? <span className="text-foreground font-semibold truncate">{client.phone}</span> : <span className="text-muted-foreground italic">Telefone não cadastrado — necessário para enviar aprovações por WhatsApp</span>}
            </div>
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-muted-foreground shrink-0" />
              {client.website ? <span className="text-foreground font-semibold truncate">{client.website}</span> : <span className="text-muted-foreground italic">Website não cadastrado</span>}
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
              <span>Insights Gerados pela IA para {client.name}</span>
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
              <span className="font-bold text-primary block mb-1">Tom de Voz:</span>
              <span className="text-foreground/80">{aiResult.toneOfVoice}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Minimals Tabs */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-none px-4 py-3 border-b-2 whitespace-nowrap hover:bg-transparent gap-1.5 ${
              activeTab === tab.id
                ? 'border-primary text-primary hover:text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon size={15} />
            <span>{tab.label}</span>
          </Button>
        ))}
      </div>

      {/* TAB 1: Brand Profile */}
      {activeTab === 'brand' && (
        <form onSubmit={handleUpdateProfile} className="card-minimals p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Identidade da Marca</h2>
              <p className="text-xs text-muted-foreground font-medium">Informações mestras que alimentam o gerador de copies e estratégias com IA.</p>
            </div>
            <Button type="submit">Salvar Alterações</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <Label htmlFor="brandSummary">Resumo da Marca (Brand Summary)</Label>
              <Textarea
                id="brandSummary"
                rows={3}
                value={profile.brandSummary || ''}
                onChange={(e) => setProfile({ ...profile, brandSummary: e.target.value })}
                placeholder="Ex: Bella Moda é uma marca de moda feminina premium focada em peças atemporais..."
              />
            </div>

            <div>
              <Label htmlFor="toneOfVoice">Tom de Voz</Label>
              <Input
                id="toneOfVoice"
                type="text"
                value={profile.toneOfVoice || ''}
                onChange={(e) => setProfile({ ...profile, toneOfVoice: e.target.value })}
                placeholder="Ex: Elegante, próximo, inspirador, empoderador"
              />
            </div>

            <div>
              <Label htmlFor="positioning">Posicionamento</Label>
              <Input
                id="positioning"
                type="text"
                value={profile.positioning || ''}
                onChange={(e) => setProfile({ ...profile, positioning: e.target.value })}
                placeholder="Ex: Premium acessível para mulheres modernas"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="targetAudience">Público-Alvo</Label>
              <Input
                id="targetAudience"
                type="text"
                value={profile.targetAudience || ''}
                onChange={(e) => setProfile({ ...profile, targetAudience: e.target.value })}
                placeholder="Ex: Mulheres de 28 a 45 anos, classe A/B que valorizam qualidade e sofisticação"
              />
            </div>

            <div>
              <Label htmlFor="defaultCta">CTA Padrão Recomendada</Label>
              <Input
                id="defaultCta"
                type="text"
                value={profile.defaultCta || ''}
                onChange={(e) => setProfile({ ...profile, defaultCta: e.target.value })}
                placeholder="Ex: Descubra a nova coleção no link da bio"
              />
            </div>

            <div>
              <Label htmlFor="brandPersonality">Personalidade da Marca</Label>
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
      )}

      {/* TAB 2: Rules */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="card-minimals p-6">
            <h2 className="text-base font-bold text-foreground mb-1">Regras Obrigatórias da Marca</h2>
            <p className="text-xs text-muted-foreground font-medium mb-4">
              A IA nunca violará essas regras ao redigir legendas, hooks ou planejar posts.
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
                    <SelectItem value="TONE">Tom de Voz</SelectItem>
                    <SelectItem value="COPY">Regra de Copy</SelectItem>
                    <SelectItem value="CTA">Regra de CTA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Input
                type="text"
                required
                placeholder="Ex: Nunca usar gírias excessivas / Sempre incluir CTA para o WhatsApp..."
                value={newRule.ruleText}
                onChange={(e) => setNewRule({ ...newRule, ruleText: e.target.value })}
                className="flex-1"
              />

              <Button type="submit" className="shrink-0">
                <Plus size={16} />
                <span>Adicionar Regra</span>
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
            <h2 className="text-base font-bold text-foreground mb-1">Pilares Editoriais de Conteúdo</h2>
            <p className="text-xs text-muted-foreground font-medium mb-4">
              Distribuição temática para o gerador de calendário com IA.
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
              <h2 className="text-base font-bold text-foreground mb-1">Estilo Visual</h2>
              <p className="text-xs text-muted-foreground font-medium">
                Descreva em texto livre o estilo que a IA deve seguir ao gerar imagens — mood, composição, iconografia, fundo, etc. Isso é usado diretamente no prompt de geração.
              </p>
            </div>
            <Textarea
              rows={3}
              placeholder='Ex: "Minimalista, fundo bege/creme, tipografia preta em negrito, ícones 3D dourados, muito espaço em branco."'
              value={profile.visualStyleDescription || ''}
              onChange={(e) => setProfile({ ...profile, visualStyleDescription: e.target.value })}
            />
            <Button type="submit" size="sm">Salvar Estilo Visual</Button>
          </form>

          <div className="card-minimals p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground mb-1">Referências Visuais</h2>
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
                <span>Adicionar Referência</span>
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
            <h2 className="text-base font-bold text-foreground mb-1">Paleta de Cores</h2>
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
                    <SelectItem value="Destaque / Accent">Destaque / Accent</SelectItem>
                    <SelectItem value="Botão / CTA">Botão / CTA</SelectItem>
                    <SelectItem value="Ícones / Bordas">Ícones / Bordas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full sm:w-auto">Salvar Cor</Button>
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
                      <span className="block text-[10px] text-muted-foreground font-semibold mt-0.5 truncate">{color.usageNotes}</span>
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
              <h2 className="text-base font-bold text-foreground">Aprendizagem por Feedback</h2>
              <p className="text-xs text-muted-foreground font-medium">
                Feedbacks recebidos nas aprovações viram regras permanentes da IA.
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
                  <span>Transformar em Regra Permanente no Brand Brain</span>
                </label>
                <Button type="submit" className="w-full sm:w-auto justify-center">
                  <Send size={15} />
                  <span>Gravar na Memória</span>
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
    </div>
  )
}
