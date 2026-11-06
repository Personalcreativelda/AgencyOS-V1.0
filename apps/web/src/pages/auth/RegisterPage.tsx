import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, Lock, Mail, User, Building, AlertCircle } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ThemeMenu } from '@/components/ui/ThemeMenu'

export function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    agencyName: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await api.post('/auth/register', formData)
      setAuth(data.accessToken, data.refreshToken, data.user)
      navigate('/app/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 pt-16 sm:p-6 font-sans relative">
      <div className="absolute right-4 top-4"><ThemeMenu /></div>
      <div className="w-full max-w-md bg-card rounded-3xl p-6 sm:p-10 shadow-dialog border border-border space-y-6">
        <Logo size={48} tagline="Criar Nova Agência" wordmarkClassName="text-xl" />

        <div>
          <h2 className="text-xl font-extrabold text-foreground tracking-tight">Comece seu teste</h2>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-primary hover:underline font-bold">
              Entrar
            </Link>
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-error/10 border border-error/20 text-error-dark text-xs flex items-center gap-2.5 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="agencyName">Nome da agência</Label>
            <Input
              id="agencyName"
              type="text"
              required
              value={formData.agencyName}
              onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
              placeholder="Ex: Agência Criativa 360"
              icon={<Building />}
            />
          </div>

          <div>
            <Label htmlFor="name">Seu nome completo</Label>
            <Input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Carlos Mendes"
              icon={<User />}
            />
          </div>

          <div>
            <Label htmlFor="email">Email corporativo</Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="seu@agencia.com"
              icon={<Mail />}
            />
          </div>

          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              icon={<Lock />}
            />
          </div>

          <Button type="submit" variant="dark" size="lg" loading={loading} className="w-full mt-2">
            {!loading && (
              <>
                <span>Criar agência & acessar</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
