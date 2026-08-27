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
  const [agency, setAgency] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MANAGER')

  // AI integration
  const [aiSettings, setAiSettings] = useState<any>(null)
  const [showAiModal, setShowAiModal] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [textModel, setTextModel] = useState('gpt-4o-mini')
  const [imageModel, setImageModel] = useState('gpt-image-1')
  const [savingAi, setSavingAi] = useState(false)
  const [testingAi, setTestingAi] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [agRes, memRes, aiRes] = await Promise.all([
          api.get('/agencies/current'),
          api.get('/agencies/current/members'),
          api.get('/ai/settings'),
        ])
        setAgency(agRes.data)
        setMembers(memRes.data || [])
        setAiSettings(aiRes.data)
        setTextModel(aiRes.data.textModel || 'gpt-4o-mini')
        setImageModel(aiRes.data.imageModel || 'gpt-image-1')
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
      const { data } = await api.post('/ai/settings/test', { apiKey: apiKeyInput.trim(), textModel })
      setTestResult({ success: true, message: `Conectado com sucesso ao modelo ${data.model}.` })
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.error || 'Não foi possível conectar com essa chave.' })
    } finally {
      setTestingAi(false)
    }
  }

  const openAiModal = () => {
    setApiKeyInput('')
    setTestResult(null)
    setShowAiModal(true)
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
      setShowAiModal(false)
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
          <CardTitle>Integrações</CardTitle>
          <CardDescription>Credenciais únicas da agência</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between gap-3 p-4 bg-muted/60 hover:bg-muted rounded-2xl border border-border transition-colors">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
                <Sparkles size={19} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-foreground truncate">Integração de IA</p>
                <p className="text-[11px] text-muted-foreground font-medium truncate">
                  {aiSettings?.configured ? `Chave: ${aiSettings.apiKeyMasked}` : 'Chave própria para gerar legendas, estratégias e imagens'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {aiSettings?.configured ? <Badge variant="success">Conectado</Badge> : <Badge variant="default">Não configurado</Badge>}
              <Button type="button" variant="outline" size="sm" onClick={openAiModal}>
                <span>{aiSettings?.configured ? 'Editar' : 'Configurar'}</span>
              </Button>
              {aiSettings?.configured && (
                <button
                  onClick={handleRemoveAi}
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

      {/* AI Integration Modal */}
      <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary-dark flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <DialogTitle>{aiSettings?.configured ? 'Editar Integração de IA' : 'Configurar Integração de IA'}</DialogTitle>
                <DialogDescription>Conecte sua própria chave de API para gerar legendas, estratégias e propostas de imagem</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveAi} className="space-y-4">
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
