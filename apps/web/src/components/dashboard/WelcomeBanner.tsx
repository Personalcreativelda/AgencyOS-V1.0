import type { ReactNode } from 'react'

interface WelcomeBannerProps {
  date: ReactNode
  title: string
  description: ReactNode
  /** Small facts shown as chips (e.g. "3 pendências", "Próxima: amanhã 09:00"). */
  highlights?: ReactNode[]
  actions?: ReactNode
}

/**
 * Full-width welcome hero at the top of the dashboard. Brand green gradient with the AgencyOS
 * mark echoed as large, faint rings on the right — decoration that belongs to the brand rather
 * than generic blobs. Same look in light and dark mode.
 */
export function WelcomeBanner({ date, title, description, highlights = [], actions }: WelcomeBannerProps) {
  return (
    <section
      aria-label="Boas-vindas"
      className="relative isolate overflow-hidden rounded-[24px] px-5 py-7 text-[#fff] shadow-[0_18px_40px_-20px_rgba(0,75,80,0.6)] sm:px-8 sm:py-9 lg:px-10"
      style={{ background: 'linear-gradient(120deg, #004B50 0%, #007867 48%, #00A76F 100%)' }}
    >
      {/* Brand decoration: concentric rings + the "A" mark, very low contrast */}
      <svg aria-hidden className="pointer-events-none absolute -right-24 -top-28 -z-10 h-[420px] w-[420px] opacity-[0.16] sm:-right-10" viewBox="0 0 420 420" fill="none">
        <circle cx="210" cy="210" r="208" stroke="#fff" strokeWidth="2" />
        <circle cx="210" cy="210" r="160" stroke="#fff" strokeWidth="2" />
        <circle cx="210" cy="210" r="112" stroke="#fff" strokeWidth="2" />
        <path d="M168 262 210 162l42 100" stroke="#fff" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="210" cy="232" r="9" fill="#C8FAD6" />
      </svg>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-[#002f33]/25 to-transparent" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[13px] font-medium text-[#fff]/75">{date}</p>
          <h1 className="mt-1.5 text-[26px] font-bold leading-tight tracking-[-0.03em] sm:text-[32px]">{title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#fff]/80">{description}</p>
          {highlights.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {highlights.map((item, i) => (
                <li key={i} className="inline-flex items-center gap-2 rounded-full border border-[#fff]/20 bg-[#fff]/10 px-3 py-1.5 text-[13px] font-medium text-[#fff] backdrop-blur-sm">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0">{actions}</div>}
      </div>
    </section>
  )
}
