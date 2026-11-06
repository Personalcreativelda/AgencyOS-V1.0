import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Activity, Users, BadgeCheck, FileBarChart, LayoutList,
  CalendarRange, Kanban, Share2, Settings, ChevronDown, ChevronsLeft, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { brandIcon } from '@/components/brand/BrandIcon'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { useSidebarStore } from '@/stores/sidebarStore'

type IconComponent = ComponentType<{ size?: number | string; className?: string }>

type NavItem = {
  label: string
  href: string
  icon: IconComponent
  /** Custom active rule; defaults to the href and its sub-paths. */
  match?: (pathname: string) => boolean
  /** Full page load (pages that need a fresh OAuth/session state). */
  reload?: boolean
}
type NavSection = { id: string; label: string; items: NavItem[] }

const NAV: NavSection[] = [
  {
    id: 'overview',
    label: 'Visão geral',
    items: [
      { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
      { label: 'Performance', href: '/app/performance', icon: Activity, reload: true },
    ],
  },
  {
    id: 'clients',
    label: 'Clientes',
    items: [
      { label: 'Clientes', href: '/app/clients', icon: Users },
      { label: 'Aprovações', href: '/app/approvals', icon: BadgeCheck },
      { label: 'Relatórios mensais', href: '/app/reports', icon: FileBarChart },
    ],
  },
  {
    id: 'content',
    label: 'Conteúdo',
    items: [
      {
        label: 'Criativos',
        href: '/app/content',
        icon: LayoutList,
        // Also covers the content detail page (/app/content/:id).
        match: (p) => p.startsWith('/app/content') && !p.startsWith('/app/content/calendar') && !p.startsWith('/app/content/board'),
      },
      { label: 'Planner', href: '/app/content/calendar', icon: CalendarRange },
      { label: 'Kanban', href: '/app/content/board', icon: Kanban },
    ],
  },
  {
    id: 'ads',
    label: 'Anúncios',
    items: [
      { label: 'Meta Ads', href: '/app/ads', icon: brandIcon('META_ADS') },
      { label: 'Google Ads', href: '/app/google', icon: brandIcon('GOOGLE_ADS'), reload: true },
      { label: 'TikTok Ads', href: '/app/tiktok-ads', icon: brandIcon('TIKTOK_ADS') },
      { label: 'LinkedIn Ads', href: '/app/linkedin-ads', icon: brandIcon('LINKEDIN_ADS') },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrações',
    items: [{ label: 'Redes sociais', href: '/app/social', icon: Share2 }],
  },
]

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)

const isActive = (pathname: string, item: NavItem) => (item.match ? item.match(pathname) : matches(pathname, item.href))

function useIsDesktop() {
  const query = '(min-width: 1024px)'
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setDesktop(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return desktop
}

const itemClass = (active: boolean) =>
  cn(
    'group/item relative flex items-center gap-2.5 rounded-md text-[13px] font-medium outline-none transition-colors duration-150',
    'focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none',
    active
      ? 'bg-primary/10 text-foreground font-semibold before:absolute before:left-0 before:h-4 before:w-0.5 before:rounded-full before:bg-primary'
      : 'text-sidebar-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted'
  )

/** Animated open/close using the grid-rows 0fr → 1fr trick (no fixed heights). */
function Collapse({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return (
    <div
      id={id}
      aria-hidden={!open}
      className={cn(
        'grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none',
        open ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

function RailTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>{label}</TooltipContent>
    </Tooltip>
  )
}

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { pathname } = useLocation()
  const asideRef = useRef<HTMLElement>(null)
  const isDesktop = useIsDesktop()
  const { collapsed, closed, toggleCollapsed, toggleGroup, openGroup } = useSidebarStore()
  const rail = collapsed && isDesktop

  // Collapsible descendants can override visibility; inert also removes hidden links from keyboard navigation.
  useEffect(() => {
    asideRef.current?.toggleAttribute('inert', !isDesktop && !mobileOpen)
  }, [isDesktop, mobileOpen])

  // Keep the category that holds the current page open.
  useEffect(() => {
    for (const section of NAV) {
      if (section.items.some((item) => isActive(pathname, item))) openGroup(section.id)
    }
  }, [pathname, openGroup])

  // Keep keyboard focus inside the mobile drawer and restore it to the opener.
  useEffect(() => {
    if (!mobileOpen || isDesktop) return
    const previous = document.activeElement as HTMLElement | null
    const aside = asideRef.current
    const focusable = () => Array.from(aside?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]') || []).filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
    focusable()[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const elements = focusable()
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [mobileOpen, isDesktop])

  // Ctrl/Cmd + B toggles the rail on desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && window.matchMedia('(min-width: 1024px)').matches) {
        const target = e.target as HTMLElement
        if (target.closest('input, textarea, select, [contenteditable=true]')) return
        e.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleCollapsed])

  const navItem = (item: NavItem) => {
    const active = isActive(pathname, item)
    const Icon = item.icon
    const link = (
      <NavLink
        key={item.href}
        to={item.href}
        reloadDocument={item.reload}
        onClick={onClose}
        aria-label={rail ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={cn(itemClass(active), rail ? 'mx-auto size-9 justify-center' : 'px-2.5 py-2')}
      >
        <Icon size={16} className="shrink-0 opacity-80 transition-opacity duration-150 group-hover/item:opacity-100 group-focus-visible/item:opacity-100" />
        {!rail && <span className="truncate">{item.label}</span>}
      </NavLink>
    )
    return rail ? <RailTooltip key={item.href} label={item.label}>{link}</RailTooltip> : link
  }

  const settingsLink = (
    <NavLink
      to="/app/settings"
      onClick={onClose}
      aria-label={rail ? 'Configurações' : undefined}
      className={cn(itemClass(matches(pathname, '/app/settings')), rail ? 'mx-auto size-9 justify-center' : 'w-full px-2.5 py-2')}
    >
      <Settings size={16} className="shrink-0" />
      {!rail && <span className="truncate">Configurações</span>}
    </NavLink>
  )

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        ref={asideRef}
        role={!isDesktop && mobileOpen ? "dialog" : undefined}
        aria-modal={!isDesktop && mobileOpen ? true : undefined}
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-y-0 left-0 z-40 isolate flex w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar',
          'transition-[width,transform] duration-200 ease-out motion-reduce:transition-none lg:relative lg:translate-x-0',
          rail ? 'lg:w-[64px]' : 'lg:w-[232px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full invisible lg:visible'
        )}
      >
        {/* Brand */}
        <div className={cn('flex h-14 shrink-0 items-center', rail ? 'justify-center px-0' : 'justify-between gap-3 px-5')}>
          {rail ? <LogoMark size={28} /> : <Logo size={28} tagline={null} />}
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="shrink-0 rounded-full p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Desktop collapse handle, sitting on the sidebar's edge */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={`${collapsed ? 'Expandir' : 'Recolher'} menu (Ctrl+B)`}
          className="absolute -right-3 top-[17px] z-10 hidden size-6 items-center justify-center rounded-full border border-sidebar-border bg-card text-muted-foreground shadow-z4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:flex"
        >
          <ChevronsLeft size={14} className={cn('transition-transform duration-300', collapsed && 'rotate-180')} />
        </button>

        {/* Navigation */}
        <nav className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
          {NAV.map((section, index) => {
            if (rail) {
              return (
                <div key={section.id} className="space-y-1">
                  {index > 0 && <div className="mx-auto my-3 h-px w-8 bg-border" />}
                  {section.items.map(navItem)}
                </div>
              )
            }

            const open = !closed[section.id]
            const holdsActive = section.items.some((item) => isActive(pathname, item))
            return (
              <div key={section.id} className={cn(index > 0 && 'mt-5')}>
                <button
                  type="button"
                  onClick={() => toggleGroup(section.id)}
                  aria-expanded={open}
                  aria-controls={`sidebar-section-${section.id}`}
                  className="group/section flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span className="truncate">{section.label}</span>
                  {!open && holdsActive && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  <ChevronDown
                    size={13}
                    className={cn(
                      'ml-auto shrink-0 transition-[transform,opacity] duration-200 group-hover/section:opacity-100 group-focus-visible/section:opacity-100 motion-reduce:transition-none',
                      section.id === 'ads' || section.id === 'integrations' ? 'opacity-70' : 'opacity-0',
                      !open && '-rotate-90 opacity-100'
                    )}
                  />
                </button>
                <Collapse id={`sidebar-section-${section.id}`} open={open}>
                  <div className="space-y-0.5 pt-1">
                    {section.items.map(navItem)}
                  </div>
                </Collapse>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          {rail ? <RailTooltip label="Configurações">{settingsLink}</RailTooltip> : settingsLink}
        </div>
      </aside>
    </TooltipProvider>
  )
}
