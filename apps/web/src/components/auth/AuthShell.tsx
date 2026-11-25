import type { ReactNode } from 'react'
import { Check, Croissant } from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'
import { MadeBy } from '@/components/brand/MadeBy'
import { ThemeMenu } from '@/components/ui/ThemeMenu'
import { PlatformIcon } from '@/components/planner/PlatformIcon'

// Brand ink: the deep end of the AgencyOS teal, used flat (no gradient, no decoration).
const BRAND_INK = '#0A4A4C'

function Wordmark({ size }: { size: 'sm' | 'md' }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={size === 'md' ? 40 : 32} />
      <span className={size === 'md' ? 'text-xl font-semibold' : 'text-lg font-semibold'} translate="no">
        Agency<span className="text-[#5BE49B]">OS</span>
      </span>
    </div>
  )
}

/**
 * What AgencyOS actually does, shown instead of decoration: one content card the way it looks in
 * the app once the client approved it (example data).
 */
function ApprovedContentPreview() {
  return (
    <figure aria-label="Exemplo de conteúdo aprovado pelo cliente" className="w-full max-w-[400px] rounded-2xl bg-[#fff] p-4 text-[#1C252E] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.45)]">
      <div className="flex items-start gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-[#F3E4CC] text-[#8A5A2B]">
          <Croissant size={32} strokeWidth={1.5} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#637381]">Padaria Costa do Sol</p>
          <p className="mt-1 text-[15px] font-medium leading-5">Pão quente às 7h, todos os dias</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#637381]">
            <span className="tabular-nums">Sex, 28 nov · 18:00</span>
            <span aria-hidden className="inline-flex items-center gap-1.5">
              <PlatformIcon platform="INSTAGRAM" size={12} />
              <PlatformIcon platform="FACEBOOK" size={12} />
              <PlatformIcon platform="WHATSAPP" size={12} />
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#1C252E]/[0.08] pt-4">
        <span className="inline-flex items-center gap-2 rounded-md bg-[#00A76F]/10 px-2 py-1 text-xs font-medium text-[#007867]">
          <span className="size-1.5 rounded-full bg-[#00A76F]" aria-hidden />Aprovado pelo cliente
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-[#637381]">
          <Check size={14} strokeWidth={1.5} aria-hidden />Agendado
        </span>
      </div>
    </figure>
  )
}

/**
 * Split auth layout: brand panel on the left from `lg`, the form on the right. Only presentation;
 * the page keeps its own form, validation and submit logic.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[var(--sab)] font-sans lg:flex-row">
      {/* Brand panel */}
      <aside
        className="relative hidden w-[45%] max-w-[640px] shrink-0 flex-col justify-between px-12 py-12 text-[#fff] lg:flex"
        style={{ backgroundColor: BRAND_INK }}
      >
        <Wordmark size="md" />

        <div>
          <h1 className="max-w-lg text-balance text-4xl font-semibold leading-tight tracking-[-0.02em]">
            Planeje, aprove e publique o conteúdo de todos os clientes
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[#fff]/75">
            O calendário editorial, a aprovação do cliente por link e a publicação nas redes, num só lugar.
          </p>
          <div className="mt-12">
            <ApprovedContentPreview />
          </div>
        </div>

        <MadeBy tone="onBrand" className="justify-start" />
      </aside>

      {/* Phones/tablets: compact brand header under the status bar; the form sits on a sheet below it. */}
      <header
        className="px-6 pb-12 pt-[calc(var(--sat)+1.25rem)] text-[#fff] lg:hidden"
        style={{ backgroundColor: BRAND_INK }}
      >
        <div className="flex items-center justify-between">
          <Wordmark size="sm" />
          <div className="rounded-full bg-[#fff]/10 [&_button]:text-[#fff]"><ThemeMenu /></div>
        </div>
        <h1 className="mt-8 max-w-xs text-balance text-2xl font-semibold leading-tight tracking-[-0.01em]">
          Planeje, aprove e publique para todos os clientes
        </h1>
      </header>

      {/* Form side */}
      <main className="relative -mt-6 flex min-w-0 flex-1 flex-col items-center rounded-t-3xl bg-background px-5 pb-10 pt-8 sm:px-10 lg:mt-0 lg:justify-center lg:rounded-none lg:py-16">
        <div className="absolute right-4 top-4 hidden lg:block"><ThemeMenu /></div>
        <div className="w-full max-w-[420px]">
          {children}
          <MadeBy className="mt-10 lg:hidden" />
        </div>
      </main>
    </div>
  )
}
