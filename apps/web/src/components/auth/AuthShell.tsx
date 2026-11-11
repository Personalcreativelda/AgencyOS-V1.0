import type { ReactNode } from 'react'
import { BarChart3, CheckCircle2, Share2 } from 'lucide-react'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { ThemeMenu } from '@/components/ui/ThemeMenu'

const POINTS = [
  { icon: CheckCircle2, title: 'Aprovações em 1 clique', text: 'Portal direto para o cliente aprovar ou pedir ajustes, sem login.' },
  { icon: Share2, title: 'Publicação em 6 redes', text: 'Instagram, Facebook, LinkedIn, TikTok, YouTube e WhatsApp.' },
  { icon: BarChart3, title: 'Relatórios automáticos', text: 'Métricas de anúncios e orgânico consolidadas para cada cliente.' },
]

/**
 * Split auth layout (Stitch "Login" screen): brand panel on the left from `lg`, the form on the
 * right. Only presentation — the page keeps its own form, validation and submit logic.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background pb-[var(--sab)] pt-[var(--sat)] font-sans">
      {/* Brand panel */}
      <aside
        className="relative hidden w-[45%] max-w-[640px] shrink-0 flex-col justify-between overflow-hidden px-14 py-12 text-[#fff] lg:flex"
        style={{ background: 'linear-gradient(150deg, #004B50 0%, #007867 52%, #00A76F 100%)' }}
      >
        <svg aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[640px] w-[640px] opacity-[0.12]" viewBox="0 0 640 640" fill="none">
          <circle cx="320" cy="320" r="318" stroke="#fff" strokeWidth="1.5" />
          <circle cx="320" cy="320" r="230" stroke="#fff" strokeWidth="1.5" strokeDasharray="4 8" />
          <circle cx="320" cy="320" r="142" stroke="#fff" strokeWidth="1.5" />
        </svg>
        <svg aria-hidden className="pointer-events-none absolute -bottom-24 right-6 h-[360px] w-[360px] opacity-[0.07]" viewBox="0 0 40 40" fill="none">
          <path d="M11.5 29 20 11 28.5 29" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div className="relative flex items-center gap-3">
          <LogoMark size={40} />
          <span className="text-[22px] font-bold tracking-tight">Agency<span className="text-[#5BE49B]">OS</span></span>
        </div>

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#fff]/25 bg-[#fff]/10 px-3 py-1 text-[13px] font-medium">
            <span className="size-1.5 rounded-full bg-[#5BE49B]" /> Brand Brain integrado
          </span>
          <h1 className="mt-6 max-w-md text-[44px] font-bold leading-[1.08] tracking-[-0.03em]">O sistema operacional da sua agência</h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[#fff]/80">
            Planeje, aprove e publique conteúdo para todos os clientes — com o Brand Brain aprendendo cada marca.
          </p>
          <ul className="mt-10 space-y-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#fff]/20 bg-[#fff]/10">
                  <p.icon size={19} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{p.title}</span>
                  <span className="mt-0.5 block text-sm text-[#fff]/70">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[13px] text-[#fff]/60">© {new Date().getFullYear()} AgencyOS</p>
      </aside>

      {/* Form side */}
      <main className="relative flex min-w-0 flex-1 flex-col items-center justify-center px-5 py-16 sm:px-10">
        <div className="absolute right-4 top-4"><ThemeMenu /></div>
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden"><Logo size={44} tagline="Sistema operacional de agências" wordmarkClassName="text-xl" /></div>
          {children}
        </div>
      </main>
    </div>
  )
}
