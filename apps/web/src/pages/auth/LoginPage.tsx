import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, ArrowRight, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuth(data.accessToken, data.refreshToken, data.user)
      navigate('/app/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Credenciais inválidas. Verifique os dados informados.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4 font-sans relative">
      <div className="w-full max-w-md bg-card rounded-3xl p-8 sm:p-10 shadow-dialog border border-border space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
            <Zap className="text-[#fff] w-6 h-6 fill-[#fff]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">AgencyOS</h1>
            <p className="text-xs text-primary font-bold">Sistema Operacional de Agências</p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-foreground tracking-tight">Entrar na sua Agência</h2>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Novo usuário?{' '}
            <Link to="/register" className="text-primary hover:underline font-bold">
              Criar uma agência
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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@agencia.com"
              icon={<Mail />}
            />
          </div>

          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type={showPass ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock />}
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
          </div>

          <Button type="submit" variant="dark" size="lg" loading={loading} className="w-full mt-2">
            {!loading && (
              <>
                <span>Acessar Painel</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
