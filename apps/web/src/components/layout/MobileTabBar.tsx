import { NavLink, useLocation } from 'react-router-dom'
import { BadgeCheck, Home, Menu, PanelsTopLeft, UsersRound } from 'lucide-react'
import { useNavCounts } from '@/hooks/useNavCounts'
import { cn } from '@/lib/utils'

type Tab = {
  label: string
  to: string
  icon: typeof Home
  match: (pathname: string) => boolean
}

const TABS: Tab[] = [
  { label: 'Início', to: '/app/dashboard', icon: Home, match: (p) => p.startsWith('/app/dashboard') },
  { label: 'Conteúdos', to: '/app/content', icon: PanelsTopLeft, match: (p) => p.startsWith('/app/content') },
  { label: 'Clientes', to: '/app/clients', icon: UsersRound, match: (p) => p.startsWith('/app/clients') },
  { label: 'Aprovações', to: '/app/approvals', icon: BadgeCheck, match: (p) => p.startsWith('/app/approvals') },
]

/**
 * Phone bottom navigation (hidden from `lg` up, where the sidebar takes over). Material 3 style:
 * five equal slots, the active one gets a tinted pill behind its icon. Creating things is a
 * per-page floating button (see <PageFab>), not a slot here.
 */
export function MobileTabBar({ onOpenMenu, menuOpen, unread = 0 }: { onOpenMenu: () => void; menuOpen: boolean; unread?: number }) {
  const { pathname } = useLocation()
  const { pendingApprovals: pending } = useNavCounts()

  const slot = 'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pb-1.5 pt-2 text-xs font-medium transition-colors active:opacity-70'
  const pill = (active: boolean) => cn('relative flex h-8 w-14 items-center justify-center rounded-full transition-colors', active && 'bg-primary/15')

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'var(--sab)' }}
    >
      <div className="mx-auto flex h-16 max-w-xl items-stretch px-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname)
          const badge = tab.to === '/app/approvals' ? pending : 0
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              className={cn(slot, active ? 'text-primary-dark dark:text-primary-light' : 'text-muted-foreground')}
            >
              <span className={pill(active)}>
                <tab.icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {!!badge && (
                  <span className="absolute right-1.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold leading-none text-[#fff] ring-2 ring-card">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className={cn('leading-none', active && 'font-semibold')}>{tab.label}</span>
            </NavLink>
          )
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={unread ? `Mais opções, ${unread} notificações por ler` : 'Mais opções'}
          aria-expanded={menuOpen}
          className={cn(slot, menuOpen ? 'text-primary-dark dark:text-primary-light' : 'text-muted-foreground')}
        >
          <span className={pill(menuOpen)}>
            <Menu size={22} strokeWidth={1.8} />
            {unread > 0 && <span aria-hidden className="absolute right-3.5 top-0.5 size-2.5 rounded-full bg-error ring-2 ring-card" />}
          </span>
          <span className="leading-none">Mais</span>
        </button>
      </div>
    </nav>
  )
}
