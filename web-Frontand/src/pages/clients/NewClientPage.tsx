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
    } catch {
      alert('Erro ao enviar o logotipo.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/clients', formData)
      navigate(`/app/clients/${data.id}`)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao criar cliente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
      <Link
        to="/app/clients"
        className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Voltar para clientes</span>
      </Link>

      <div className="card-minimals p-8 space-y-6">
        <div className="flex items-center gap-3.5 border-b border-border pb-5">
          <UploadableAvatar
            src={formData.logoUrl}
            rounded="rounded-2xl"
            className="w-12 h-12 bg-primary/10"
            fallback={<Building2 className="w-6 h-6 text-primary-dark" />}
            onUpload={handleLogoUpload}
          />
          <div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">Cadastrar Novo Cliente</h1>
            <p className="text-xs text-muted-foreground font-medium">
              Configure a marca para inicializar o Brand Brain com IA. Envie o logotipo para a IA usá-lo (em vez de inventar um) nas propostas de criativo.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="name">Nome Comercial da Marca *</Label>
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
              <Label htmlFor="legalName">Razão Social (Opcional)</Label>
              <Input
                id="legalName"
                type="text"
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                placeholder="Ex: Bella Moda Comércio Ltda"
              />
            </div>

            <div>
              <Label htmlFor="industry">Segmento / Indústria</Label>
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
                Se preenchido, a IA pode incluir o endereço em criativos como panfletos ou anúncios de loja, quando fizer sentido.
              </p>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Descrição & Diferenciais do Cliente</Label>
              <Textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva a história da marca, diferenciais e serviços principais. Isso alimenta o Brand Brain."
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-5 border-t border-border">
            <Button asChild variant="ghost">
              <Link to="/app/clients">Cancelar</Link>
            </Button>
            <Button type="submit" loading={loading}>
              {!loading && (
                <>
                  <Sparkles size={16} />
                  <span>Cadastrar & Ativar Brand Brain</span>
                </>
              )}
              {loading && <span>Salvando...</span>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
