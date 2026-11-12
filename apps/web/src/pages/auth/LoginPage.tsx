import { AuthShell } from '@/components/auth/AuthShell'
import React, { useEffect, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { GoogleLogo } from '@/components/auth/GoogleLogo'

const GOOGLE_ERRORS: Record<string, string> = {
  sem_conta: 'Não existe nenhuma conta AgencyOS com esse e-mail Google. Peça um convite à sua agência ou crie uma agência.',
  indisponivel: 'O login com Google ainda não está configurado nesta plataforma.',
  falhou: 'Não foi possível entrar com o Google. Tente novamente.',
}

function capacitorPlugin(name: string): any {
  const cap = (window as any).Capacitor
  return cap?.isNativePlatform?.() ? cap.Plugins?.[name] : null
}

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [params, setParams] = useSearchParams()

  // Coming back from Google: trade the one-time code for a session.
  useEffect(() => {
    const code = params.get('google_code')
    const googleError = params.get('google_error')
    if (!code && !googleError) return
    capacitorPlugin('Browser')?.close?.().catch?.(() => {})
    setParams({}, { replace: true })
    if (googleError) { setError(GOOGLE_ERRORS[googleError] || GOOGLE_ERRORS.falhou); return }
    setGoogleLoading(true)
    api.post('/auth/google/exchange', { code })
      .then(({ data }) => { setAuth(data.accessToken, data.refreshToken, data.user); navigate('/app/dashboard', { replace: true }) })
      .catch((err) => setError(err.response?.data?.error || GOOGLE_ERRORS.falhou))
      .finally(() => setGoogleLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const signInWithGoogle = () => {
    setError('')
    const browser = capacitorPlugin('Browser')
    const base = `${(api.defaults.baseURL || '/api/v1').replace(/\/$/, '')}/auth/google/start`
    const url = new URL(base, window.location.origin)
    if (browser?.open) {
      // Google doesn't allow sign-in inside an app WebView: use the system browser and come back
      // through agencyos://login?google_code=…
      url.searchParams.set('app', '1')
      browser.open({ url: url.toString() })
      return
    }
    setGoogleLoading(true)
    window.location.assign(url.toString())
  }

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
    <AuthShell>
      <div className="space-y-7">
        <div>
          <h2 className="text-[28px] font-bold tracking-[-0.02em] text-foreground">Entrar na sua agência</h2>
          <p className="mt-2 text-[15px] text-muted-foreground">
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

        <Button type="button" variant="outline" size="lg" loading={googleLoading} onClick={signInWithGoogle}
          className="w-full gap-3 border-border bg-card text-[15px] font-semibold text-foreground hover:bg-muted">
          {!googleLoading && <><GoogleLogo className="size-5" /><span>Continuar com Google</span></>}
        </Button>

        <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground" aria-hidden>
          <span className="h-px flex-1 bg-border" />ou com e-mail<span className="h-px flex-1 bg-border" />
        </div>

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
              autoComplete="email"
              className="h-12 rounded-lg"
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
              autoComplete="current-password"
              className="h-12 rounded-lg"
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                  className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
          </div>

          <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
            {!loading && (
              <>
                <span>Acessar painel</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </AuthShell>
  )
}
