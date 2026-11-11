import React, { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LogOut, Bell, CheckCheck, Inbox, Camera, ChevronDown,
} from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { HeaderSearch } from '@/components/layout/HeaderSearch'
import { LogoMark } from '@/components/brand/Logo'
import { ThemeMenu } from '@/components/ui/ThemeMenu'
import { useAuthStore } from '@/stores/authStore'
import { cn, getInitials, ROLE_LABELS, timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import { uploadFile } from '@/lib/upload'
import { toast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import { Badge } from '@/components/ui/Badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'

// Title shown in the desktop top bar for the current route (longest prefix wins).
const PAGE_TITLES: [string, string][] = [
  ['/app/dashboard', 'Dashboard'],
  ['/app/performance', 'Performance'],
  ['/app/clients/new', 'Novo cliente'],
  ['/app/clients', 'Clientes'],
  ['/app/approvals', 'Aprovações'],
  ['/app/reports', 'Relatórios mensais'],
  ['/app/content/calendar', 'Planner'],
  ['/app/content/board', 'Kanban'],
  ['/app/content', 'Conteúdos'],
  ['/app/ads', 'Meta Ads'],
  ['/app/google', 'Google Ads & Analytics'],
  ['/app/tiktok-ads', 'TikTok Ads'],
  ['/app/linkedin-ads', 'LinkedIn Ads'],
  ['/app/social', 'Redes sociais'],
  ['/app/settings', 'Configurações'],
]

export function AppLayout() {
  const { user, logout, updateUser } = useAuthStore()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pageTitle = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? ''
  const [navOpen, setNavOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  // The page scrolls inside this container (not the window), so the router's default
  // behaviour never resets it — every new page would open at the previous page's position.
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [pathname])
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/notifications')
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {}
  }

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleNotificationClick = async (n: any) => {
    if (!n.readAt) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
      setUnreadCount((c) => Math.max(0, c - 1))
      api.post(`/notifications/${n.id}/read`).catch(() => {})
    }
    try {
      const entityId = n.data ? JSON.parse(n.data).entityId : null
      if (entityId) navigate(`/app/content/${entityId}`)
    } catch {}
  }

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })))
    setUnreadCount(0)
    api.post('/notifications/read-all').catch(() => {})
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { publicUrl } = await uploadFile(file)
      await api.patch('/auth/me', { avatarUrl: publicUrl })
      updateUser({ avatarUrl: publicUrl })
    } catch (err) {
      toast.error('Erro ao enviar foto de perfil', getErrorMessage(err))
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {}
    logout()
    navigate('/login')
  }

  const closeNav = React.useCallback(() => setNavOpen(false), [])

  return (
    <div className="flex h-dvh overflow-hidden bg-background font-sans">
      <a href="#page-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-card focus:p-3 focus:text-foreground">Pular para o conteúdo</a>
      {/* Mobile/Tablet backdrop */}
      {navOpen && (
        <div
          className="fixed inset-0 isolate bg-[#000]/50 z-30 lg:hidden"
          onClick={closeNav}
        />
      )}

      <Sidebar mobileOpen={navOpen} onClose={closeNav} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Minimals Header */}
        {/* Phones: header sits on the page background (no divider) like a native app bar;
            the menu lives in the bottom tab bar's "Mais". Desktop keeps the card header. */}
        <header className="flex flex-col isolate shrink-0 z-20 bg-background pt-[var(--sat)] lg:border-b lg:border-border lg:bg-card lg:pt-0">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:h-16 lg:px-8">
            <div className="hidden min-w-0 flex-1 items-center lg:flex">
              <HeaderSearch />
            </div>
            <Link to="/app/dashboard" aria-label="AgencyOS — início" className="flex min-w-0 items-center gap-2.5 lg:hidden">
              <LogoMark size={32} />
              <span className="text-[17px] font-semibold tracking-tight text-foreground">Agency<span className="text-primary">OS</span></span>
            </Link>

            <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
              <ThemeMenu />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Notificações" className="relative p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-error rounded-full text-[11px] font-bold text-[#fff]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
                <div className="flex items-center justify-between px-3.5 py-3 border-b border-border">
                  <span className="text-xs font-bold text-foreground">Notificações</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                    >
                      <CheckCheck size={12} />
                      <span>Marcar todas como lidas</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center px-4">
                      <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground font-medium">Nenhuma notificação por aqui.</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          'w-full text-left px-3.5 py-3 border-b border-border last:border-0 hover:bg-muted/70 transition-colors flex gap-2.5',
                          !n.readAt && 'bg-primary/5'
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', n.readAt ? 'bg-transparent' : 'bg-primary')} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{n.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 font-medium">{timeAgo(n.createdAt)}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Avatar & Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Menu do usuário" className="flex items-center gap-2.5 rounded-full p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:rounded-xl lg:py-1 lg:pl-1 lg:pr-3">
                  <Avatar className="h-9 w-9 ring-2 ring-primary/30 lg:h-10 lg:w-10">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                    <AvatarFallback className="bg-primary/20 text-primary-dark text-sm">
                      {getInitials(user?.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden min-w-0 text-left leading-tight lg:block">
                    <span className="block max-w-[160px] truncate text-sm font-semibold text-foreground">{user?.name}</span>
                    <span className="block max-w-[160px] truncate text-xs text-muted-foreground">{ROLE_LABELS[user?.role || ''] || user?.role}</span>
                  </span>
                  <ChevronDown size={15} aria-hidden className="hidden text-muted-foreground lg:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="px-3 py-2 normal-case tracking-normal">
                  <p className="text-sm font-bold text-foreground truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  <Badge variant="primary" className="mt-1">{user?.role}</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => avatarInputRef.current?.click()}>
                  <Camera size={15} />
                  <span>Alterar foto de perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="text-error data-[highlighted]:bg-error/10 data-[highlighted]:text-error"
                >
                  <LogOut size={15} />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
          </div>

        </header>

        {/* Page View */}
        <div ref={scrollRef} className="flex-1 overflow-auto bg-background">
          {/* Bottom padding keeps the last item clear of the floating tab bar on phones. */}
          <div id="page-content" tabIndex={-1} className="min-w-0 pb-[calc(5.5rem+var(--sab))] outline-none lg:pb-0"><Outlet /></div>
        </div>
      </main>

      <MobileTabBar onOpenMenu={() => setNavOpen(true)} menuOpen={navOpen} unread={unreadCount} />
    </div>
  )
}
