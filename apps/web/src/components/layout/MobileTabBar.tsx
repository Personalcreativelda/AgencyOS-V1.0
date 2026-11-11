import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Home, PanelsTopLeft, BadgeCheck, Menu, Plus } from 'lucide-react'
import { useNavCounts } from '@/hooks/useNavCounts'
import { cn } from '@/lib/utils'

type Tab = {
  label: string
  to: string
  icon: typeof Home
  match: (pathname: string) => boolean
}

const LEFT: Tab[] = [
  { label: 'Início', to: '/app/dashboard', icon: Home, match: (p) => p.startsWith('/app/dashboard') },
  { label: 'Conteúdos', to: '/app/content', icon: PanelsTopLeft, match: (p) => p.startsWith('/app/content') },
]
const APPROVALS: Tab = { label: 'Aprovações', to: '/app/approvals', icon: BadgeCheck, match: (p) => p.startsWith('/app/approvals') }

/**
 * Phone bottom navigation bar (hidden from `lg` up, where the sidebar takes over), in the
 * Meta Business Suite pattern: docked full-width bar with five slots and a raised central action.
 *   Início · Conteúdos · [ + ] · Aprovações (pending count) · Mais (opens the full menu)
 */
export function MobileTabBar({ onOpenMenu, menuOpen, unread = 0 }: { onOpenMenu: () => void; menuOpen: boolean; unread?: number }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const { pendingApprovals: pending } = useNavCounts()

  const slot = 'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 text-[11px] font-medium transition-colors active:opacity-70'

  const renderTab = (tab: Tab, badge?: number) => {
    const active = tab.match(pathname)
    return (
      <NavLink
        key={tab.to}
        to={tab.to}
        aria-current={active ? 'page' : undefined}
        className={cn(slot, active ? 'text-foreground' : 'text-muted-foreground')}
      >
        <span className="relative">
          <tab.icon size={23} strokeWidth={active ? 2.3 : 1.8} />
          {!!badge && (
            <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-[#fff] ring-2 ring-card">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        <span className={cn('leading-none', active && 'font-semibold')}>{tab.label}</span>
        {active && <span aria-hidden className="absolute top-0 h-[3px] w-8 rounded-b-full bg-primary" />}
      </NavLink>
    )
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-16 max-w-xl items-stretch px-1">
        {LEFT.map((tab) => renderTab(tab))}

        {/* Raised central action */}
        <div className="flex flex-1 items-start justify-center">
          <button
            type="button"
            onClick={() => navigate('/app/content?novo=1')}
            aria-label="Novo conteúdo"
            className="-mt-5 flex size-[58px] items-center justify-center rounded-[18px] bg-primary text-[#fff] shadow-[0_10px_24px_-8px_rgba(0,120,103,0.6)] ring-4 ring-card transition-transform hover:bg-primary-dark active:scale-95 focus-visible:outline-none focus-visible:ring-primary/40"
          >
            <Plus size={28} strokeWidth={2.4} />
          </button>
        </div>

        {renderTab(APPROVALS, pending)}

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={unread ? `Mais opções, ${unread} notificações por ler` : 'Mais opções'}
          aria-expanded={menuOpen}
          className={cn(slot, menuOpen ? 'text-foreground' : 'text-muted-foreground')}
        >
          <span className="relative">
            <Menu size={23} strokeWidth={1.8} />
            {unread > 0 && <span aria-hidden className="absolute -right-1 -top-0.5 size-2.5 rounded-full bg-error ring-2 ring-card" />}
          </span>
          <span className="leading-none">Mais</span>
        </button>
      </div>
    </nav>
  )
}
