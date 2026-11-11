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
            className="relative mx-auto flex size-12 items-center justify-center rounded-xl text-[#fff] shadow-[0_6px_14px_-6px_rgba(0,75,80,0.7)]"
            style={{ background: 'linear-gradient(140deg, #004B50, #00A76F)' }}>
            <Brain size={22} />
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
    {/* Compact row on every screen: status + engine at a glance, the menu stays visible */}
    <Link
      to="/app/settings"
      onClick={onNavigate}
      aria-label={`Brand Brain — ${status}${engine ? `, ${engine}` : ''}`}
      className="group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-[#fff] shadow-[0_8px_18px_-12px_rgba(0,75,80,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      style={{ background: 'linear-gradient(140deg, #004B50 0%, #007867 60%, #00A76F 100%)' }}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#fff]/20 bg-[#fff]/10">
        <Brain size={18} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-sm font-semibold">Brand Brain</span>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[#fff]/80">
          <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dot, connected && 'animate-pulse')} />
          <span className="truncate">{status}{engine ? ` · ${engine}` : ''}</span>
        </span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-[#fff]/80 transition-transform group-hover:translate-x-0.5" />
    </Link>

    </>
  )
}
