import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Brain } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'

const PROVIDER_LABELS: Record<string, string> = { openai: 'OpenAI', gemini: 'Gemini', anthropic: 'Claude' }

type AiSettings = {
  providers: { provider: string; textModel?: string | null }[]
  textProvider: string | null
}

/** Real Brand Brain status: which AI provider/model the agency's content generation runs on. */
function useBrandBrainStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['brand-brain', 'status'],
    queryFn: async ({ signal }) => (await api.get<AiSettings>('/ai/settings', { signal })).data,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const active = data?.providers.find((p) => p.provider === data.textProvider) || data?.providers[0]
  return {
    loading: isLoading,
    connected: Boolean(active),
    engine: active ? [PROVIDER_LABELS[active.provider] || active.provider, active.textModel].filter(Boolean).join(' · ') : null,
  }
}

/**
 * Sidebar footer card announcing Brand Brain (Stitch sidebar). Brand-green surface, live status
 * dot and the engine actually in use; links to the AI settings.
 */
export function BrandBrainCard({ rail, onNavigate }: { rail: boolean; onNavigate?: () => void }) {
  const { loading, connected, engine } = useBrandBrainStatus()
  const dot = connected ? 'bg-[#5BE49B]' : 'bg-[#FFD666]'

  if (rail) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link to="/app/settings" onClick={onNavigate} aria-label={`Brand Brain — ${connected ? 'ativo' : 'IA padrão'}`}
            className="relative mx-auto flex size-10 items-center justify-center rounded-xl text-[#fff] shadow-[0_6px_14px_-6px_rgba(0,75,80,0.7)]"
            style={{ background: 'linear-gradient(140deg, #004B50, #00A76F)' }}>
            <Brain size={19} />
            <span aria-hidden className={cn('absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-sidebar', dot)} />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>Brand Brain · {connected ? engine : 'IA padrão do servidor'}</TooltipContent>
      </Tooltip>
    )
  }

  const status = loading ? 'Verificando…' : connected ? 'Ativo' : 'IA padrão'

  return (
    <>
    {/* Compact row — default, keeps the navigation visible on normal/short screens */}
    <Link
      to="/app/settings"
      onClick={onNavigate}
      aria-label={`Brand Brain — ${status}${engine ? `, ${engine}` : ''}`}
      className="group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-[#fff] shadow-[0_8px_18px_-12px_rgba(0,75,80,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [@media(min-height:900px)]:hidden"
      style={{ background: 'linear-gradient(140deg, #004B50 0%, #007867 60%, #00A76F 100%)' }}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#fff]/20 bg-[#fff]/10">
        <Brain size={16} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[13px] font-semibold">Brand Brain</span>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[#fff]/80">
          <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dot, connected && 'animate-pulse')} />
          <span className="truncate">{status}{engine ? ` · ${engine}` : ''}</span>
        </span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-[#fff]/80 transition-transform group-hover:translate-x-0.5" />
    </Link>

    {/* Full card — only when the screen is tall enough to spare the space */}
    <Link
      to="/app/settings"
      onClick={onNavigate}
      className="group relative hidden overflow-hidden rounded-2xl p-4 text-[#fff] shadow-[0_10px_24px_-14px_rgba(0,75,80,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 [@media(min-height:900px)]:block"
      style={{ background: 'linear-gradient(140deg, #004B50 0%, #007867 55%, #00A76F 100%)' }}
    >
      {/* faint brand rings */}
      <svg aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-36 opacity-[0.18]" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="58" stroke="#fff" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="40" stroke="#fff" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="22" stroke="#fff" strokeWidth="1.5" />
      </svg>

      <div className="relative flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#fff]/20 bg-[#fff]/10">
          <Brain size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Brand Brain</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#fff]/80">
            <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dot, connected && 'animate-pulse')} />
            {loading ? 'Verificando…' : connected ? 'Ativo' : 'IA padrão do servidor'}
          </p>
        </div>
      </div>

      <p className="relative mt-3 text-[13px] leading-snug text-[#fff]/85">
        Aprende a voz de cada cliente e escreve legendas, planos e relatórios.
      </p>

      <div className="relative mt-3 flex items-center justify-between gap-2 border-t border-[#fff]/15 pt-3 text-xs">
        <span className="min-w-0 truncate font-medium text-[#fff]/75">{connected ? engine : 'Sem provedor próprio'}</span>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#fff]">
          {connected ? 'Configurar' : 'Conectar'}<ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
    </>
  )
}
