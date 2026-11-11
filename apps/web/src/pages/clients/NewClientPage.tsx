import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Building2, Globe, Mail, Phone, MapPin, Home, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { uploadFile } from '@/lib/upload'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { UploadableAvatar } from '@/components/ui/UploadableAvatar'
import { toast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import { Page } from '@/components/layout/Page'

export function NewClientPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    industry: '',
    website: '',
    description: '',
    email: '',
    phone: '',
    country: 'BR',
    city: '',
    address: '',
    logoUrl: '',
  })

  const handleLogoUpload = async (file: File) => {
    try {
      const { publicUrl } = await uploadFile(file)
      setFormData((prev) => ({ ...prev, logoUrl: publicUrl }))
    } catch (err) {
      toast.error('Erro ao enviar o logotipo', getErrorMessage(err))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/clients', formData)
      navigate(`/app/clients/${data.id}`)
    } catch (err: any) {
      toast.error('Erro ao criar cliente', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Page narrow>
      <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-sm">
        <Link to="/app/clients" className="inline-flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft size={16} aria-hidden />Voltar para Clientes
        </Link>
        <span aria-hidden className="text-muted-foreground/50">/</span>
        <span className="font-semibold text-foreground">Novo cliente</span>
      </nav>

      <div className="overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-card">
        <div className="flex flex-col gap-5 border-b border-border/70 bg-muted/30 px-5 py-6 sm:flex-row sm:items-center sm:px-8">
          <UploadableAvatar
            src={formData.logoUrl}
            rounded="rounded-2xl"
            className="size-[76px] shrink-0 border-2 border-dashed border-grey-300 bg-card"
            fallback={<span className="flex flex-col items-center gap-1 text-muted-foreground"><Building2 size={22} aria-hidden /><span className="text-[11px] font-semibold">Enviar logo</span></span>}
            onUpload={handleLogoUpload}
          />
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.02em] text-foreground">Novo cliente</h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Configure a identidade da marca para inicializar o Brand Brain. Envie o logotipo para ele usá-lo (em vez de inventar um) nas propostas de criativo.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="name">Nome comercial da marca *</Label>
              <Input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Bella Moda, Tech Solutions"
              />
            </div>

            <div>
              <Label htmlFor="legalName">Razão social (opcional)</Label>
              <Input
                id="legalName"
                type="text"
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                placeholder="Ex: Bella Moda Comércio Ltda"
              />
            </div>

            <div>
              <Label htmlFor="industry">Segmento / indústria</Label>
              <Input
                id="industry"
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="Ex: Moda Feminina, SaaS B2B, Gastronomia"
              />
            </div>

            <div>
              <Label htmlFor="website" className="flex items-center gap-1.5">
                <Globe size={14} className="text-grey-400" />
                Website
              </Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://exemplo.com.br"
              />
            </div>

            <div>
              <Label htmlFor="email" className="flex items-center gap-1.5">
                <Mail size={14} className="text-grey-400" />
                Email de Contato
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contato@marca.com.br"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone size={14} className="text-grey-400" />
                Telefone / WhatsApp
              </Label>
              <Input
                id="phone"
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+55 11 99999-0000"
              />
            </div>

            <div>
              <Label htmlFor="city" className="flex items-center gap-1.5">
                <MapPin size={14} className="text-grey-400" />
                Cidade / Estado
              </Label>
              <Input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="São Paulo, SP"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="address" className="flex items-center gap-1.5">
                <Home size={14} className="text-grey-400" />
                Endereço Completo (Opcional)
              </Label>
              <Input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Ex: Av. Paulista, 1000 - Bela Vista, São Paulo - SP"
              />
              <p className="text-[11px] text-muted-foreground font-medium mt-1.5">
                Se preenchido, o Brand Brain pode incluir o endereço em criativos como panfletos ou anúncios de loja, quando fizer sentido.
              </p>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Descrição & diferenciais do cliente</Label>
              <Textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva a história da marca, diferenciais e serviços principais. Isso alimenta o Brand Brain."
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-info/20 bg-info/[0.06] px-4 py-3.5 text-sm leading-relaxed text-foreground/85">
            <Sparkles size={18} aria-hidden className="mt-0.5 shrink-0 text-info-dark dark:text-info" />
            <p><span className="font-semibold text-foreground">Motor Brand Brain:</span> estes dados treinam o tom de voz e geram as primeiras personas e linhas editoriais do cliente automaticamente.</p>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center">
            <p className="text-[13px] text-muted-foreground sm:mr-auto"><span className="text-error">*</span> Campos marcados com asterisco são obrigatórios</p>
            <Button asChild variant="outline">
              <Link to="/app/clients">Cancelar</Link>
            </Button>
            <Button type="submit" loading={loading}>
              {!loading && (
                <>
                  <Sparkles size={16} />
                  <span>Cadastrar & ativar Brand Brain</span>
                </>
              )}
              {loading && <span>Salvando...</span>}
            </Button>
          </div>
        </form>
      </div>
    </Page>
  )
}
