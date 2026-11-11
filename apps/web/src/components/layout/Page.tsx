import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Standard page shell: same max width, gutters and vertical rhythm on every screen. */
export function Page({ children, className, narrow = false }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return (
    <div
      className={cn(
        'mx-auto w-full min-w-0 space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8',
        narrow ? 'max-w-3xl' : 'max-w-[1600px]',
        className
      )}
    >
      {children}
    </div>
  )
}

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Optional icon/avatar shown before the title. */
  icon?: ReactNode
  /** Small line above the title (e.g. a client name or breadcrumb). */
  eyebrow?: ReactNode
  /** Buttons/filters aligned right on desktop, wrapped below the title on mobile. */
  actions?: ReactNode
  className?: string
}

/** Standard page title block shared by every app page. */
export function PageHeader({ title, description, icon, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-3 xl:items-end', className)}>
      <div className="flex min-w-0 flex-1 basis-[200px] items-center gap-3.5">
        {icon && <div className="hidden shrink-0 sm:block">{icon}</div>}
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-xs font-semibold text-muted-foreground">{eyebrow}</div>}
          <h1 className="break-words text-[22px] font-semibold tracking-[-0.03em] text-foreground sm:text-[26px]">{title}</h1>
          {description && <p className="mt-1 hidden max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:block">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">{actions}</div>}
    </header>
  )
}

/** Rounded icon tile used next to page titles. */
export function PageIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('flex size-8 items-center justify-center rounded-md bg-transparent text-foreground', className)}>
      {children}
    </span>
  )
}
