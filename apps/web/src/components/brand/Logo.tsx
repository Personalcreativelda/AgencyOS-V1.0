import { cn } from '@/lib/utils'

interface LogoMarkProps {
  size?: number
  className?: string
}

/**
 * AgencyOS mark: an "A" peak (the agency) around a hub node (the operating system that
 * connects clients, content and ads) with a spark for the Brand Brain AI.
 */
export function LogoMark({ size = 40, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="AgencyOS"
    >
      <rect width="40" height="40" rx="8" fill="#007867" />
      <path d="M11.5 29L20 11L28.5 29" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="23.6" r="2.4" fill="#C8FAD6" />

    </svg>
  )
}

interface LogoProps extends LogoMarkProps {
  /** Small line under the wordmark; pass `null` to hide it. */
  tagline?: string | null
  wordmarkClassName?: string
}

/** Mark + "AgencyOS" wordmark. */
export function Logo({ size = 40, className, tagline = 'Agências de Marketing', wordmarkClassName }: LogoProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <LogoMark size={size} />
      <div className="min-w-0 leading-tight">
        <p className={cn('truncate text-[17px] font-semibold tracking-tight text-foreground', wordmarkClassName)}>
          Agency<span className="text-primary">OS</span>
        </p>
        {tagline && <p className="truncate text-[11px] font-semibold text-muted-foreground">{tagline}</p>}
      </div>
    </div>
  )
}
