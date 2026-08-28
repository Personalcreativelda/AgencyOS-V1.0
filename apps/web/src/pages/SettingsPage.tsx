import React, { useEffect, useState } from 'react'
import {
  Building, Users, Plus, Trash2, Sparkles, Eye, EyeOff, CheckCircle2, XCircle, Loader2,
} from 'lucide-react'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/Dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/Select'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getErrorMessage } from '@/lib/errors'

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
    const ok = await confirmDialog({ title: 'Remover este membro da agência?', variant: 'destructive', confirmLabel: 'Remover' })
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
      <div className="p-4 sm:p-8 space-y-8">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 space-y-8">
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
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/60 hover:bg-muted rounded-2xl border border-border transition-colors"
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

      {/* AI Integrations */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Integrações de IA</CardTitle>
            <CardDescription>Conecte quantos provedores quiser e escolha quem faz o quê</CardDescription>
          </div>

          {availableToAdd.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => openAiModal()}>
              <Plus size={14} />
              <span>Conectar Provedor</span>
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-2">
          {aiProviders.length === 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/60 rounded-2xl border border-border">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
                  <Sparkles size={19} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-foreground truncate">Nenhum provedor conectado</p>
                  <p className="text-[11px] text-muted-foreground font-medium truncate">Sem chave própria, o app usa o padrão do servidor (ou respostas mock).</p>
                </div>
              </div>
              <Button size="sm" onClick={() => openAiModal()}>
                <Plus size={14} />
                <span>Conectar Provedor</span>
              </Button>
            </div>
          ) : (
            aiProviders.map((p) => (
              <div
                key={p.provider}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/60 hover:bg-muted rounded-2xl border border-border transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
                    <Sparkles size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-foreground truncate">{AI_PROVIDERS.find((a) => a.value === p.provider)?.label || p.provider}</p>
                    <p className="text-[11px] text-muted-foreground font-medium truncate">
                      Chave: {p.apiKeyMasked} • {TEXT_MODELS_BY_PROVIDER[p.provider]?.find((m) => m.value === p.textModel)?.label || p.textModel}
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
                    onClick={() => handleRemoveAi(p.provider)}
                    className="p-1.5 text-muted-foreground hover:text-error rounded-lg transition-colors"
                    title="Remover"
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
                <Label className="normal-case tracking-normal font-bold text-grey-600 mb-1">Provedor para tarefas de texto</Label>
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
                <Label className="normal-case tracking-normal font-bold text-grey-600 mb-1">Provedor para tarefas de imagem</Label>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary-dark flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <DialogTitle>{editingProvider ? `Editar ${AI_PROVIDERS.find((p) => p.value === editingProvider)?.label}` : 'Conectar Provedor de IA'}</DialogTitle>
                <DialogDescription>Conecte sua própria chave de API para gerar legendas, estratégias e propostas de imagem</DialogDescription>
              </div>
            </div>
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
                <span>Testar Conexão</span>
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowAiModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={!apiKeyInput.trim()} loading={savingAi}>
                  {!savingAi && <span>Salvar Integração</span>}
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
