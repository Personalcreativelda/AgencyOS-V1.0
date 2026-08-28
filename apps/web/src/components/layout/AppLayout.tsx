import React, { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar, FileText, CheckSquare,
  BarChart2, Settings, LogOut, Zap, Bell, Search, Sun, Moon, Menu, X, CheckCheck, Inbox, Camera,
  List, CalendarDays, Kanban, Share2, Megaphone,
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { cn, getInitials, timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import { uploadFile } from '@/lib/upload'
import { toast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'

const navSections = [
  {
    subheader: 'Geral',
    items: [
      { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
      { label: 'Clientes', href: '/app/clients', icon: Users },
      { label: 'Conteúdos', href: '/app/calendar', icon: Calendar },
    ],
  },
  {
    subheader: 'Produção & IA',
    items: [
      {
        label: 'Workspace',
        href: '/app/content',
        icon: FileText,
        children: [
          { label: 'Criativos', href: '/app/content', icon: List, end: true },
          { label: 'Planner', href: '/app/content/calendar', icon: CalendarDays },
          { label: 'Kanban', href: '/app/content/board', icon: Kanban },
        ],
      },
      { label: 'Meta Ads', href: '/app/ads', icon: Megaphone },
      { label: 'Aprovações do Cliente', href: '/app/approvals', icon: CheckSquare },
      { label: 'Relatórios Mensais', href: '/app/reports', icon: BarChart2 },
      { label: 'Redes Sociais', href: '/app/social', icon: Share2 },
    ],
  },
]

export function AppLayout() {
  const { user, logout, updateUser } = useAuthStore()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const { mode, toggle } = useThemeStore()
  const navigate = useNavigate()
  const location = useLocation()
  // The header search only ever drives the Clientes list filter (?q=) — showing it elsewhere
  // (Redes Sociais, Configurações...) with no real target behind it is just confusing.
  const showSearch = location.pathname.startsWith('/app/clients')
  const [navOpen, setNavOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

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

  const closeNav = () => setNavOpen(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    navigate(`/app/clients?q=${encodeURIComponent(q)}`)
    closeNav()
    setMobileSearchOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans">
      {/* Mobile/Tablet backdrop */}
      {navOpen && (
        <div
          className="fixed inset-0 isolate bg-[#000]/50 z-30 lg:hidden"
          onClick={closeNav}
        />
      )}

      {/* Minimals Sidebar — off-canvas on mobile/tablet, static on desktop */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 isolate flex flex-col w-72 shrink-0 bg-sidebar border-r border-sidebar-border overflow-y-auto transition-transform duration-300 will-change-transform lg:static lg:translate-x-0 lg:will-change-auto',
          navOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo & Agency Header */}
        <div className="flex items-center justify-between gap-3 px-6 h-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Zap size={20} className="text-[#fff] fill-[#fff]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground tracking-tight leading-tight truncate">AgencyOS</h1>
              <p className="text-[11px] font-semibold text-primary truncate">Plataforma de Marketing</p>
            </div>
          </div>
          <button
            onClick={closeNav}
            className="p-2.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-4 pt-2 space-y-6">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <p className="px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                {section.subheader}
              </p>
              {section.items.map((item) => (
                'children' in item ? (
                  <div key={item.href} className="space-y-1">
                    <NavLink
                      to={item.href}
                      onClick={closeNav}
                      className={({ isActive }) =>
                        cn('nav-item-minimals', isActive && 'active')
                      }
                    >
                      <item.icon size={20} />
                      <span>{item.label}</span>
                    </NavLink>
                    <div className="pl-5 border-l border-border ml-6 space-y-0.5">
                      {item.children?.map((child) => (
                        <NavLink
                          key={child.href}
                          to={child.href}
                          end={child.end}
                          onClick={closeNav}
                          className={({ isActive }) =>
                            cn('nav-item-minimals !gap-2.5 !px-3 !py-2', isActive && 'active')
                          }
                        >
                          <child.icon size={15} />
                          <span>{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ) : (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={closeNav}
                    className={({ isActive }) =>
                      cn('nav-item-minimals', isActive && 'active')
                    }
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom Settings & User Card */}
        <div className="p-4 border-t border-border space-y-2 shrink-0">
          <NavLink
            to="/app/settings"
            onClick={closeNav}
            className={({ isActive }) => cn('nav-item-minimals', isActive && 'active')}
          >
            <Settings size={20} />
            <span>Configurações</span>
          </NavLink>

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3.5 px-4 py-2.5 text-sm font-semibold text-error hover:text-error hover:bg-error/10"
          >
            <LogOut size={20} />
            <span>Sair do Sistema</span>
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Minimals Header */}
        <header className="flex flex-col isolate bg-card border-b border-border shrink-0 z-20">
          <div className="flex items-center justify-between h-20 px-4 sm:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setNavOpen(true)}
                className="p-2.5 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden shrink-0"
              >
                <Menu size={20} />
              </button>
              {showSearch && (
                <form onSubmit={handleSearch} className="hidden sm:block">
                  <Input
                    type="text"
                    placeholder="Pesquisar clientes..."
                    icon={<Search />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-40 sm:w-64 bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-primary/40"
                  />
                </form>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {showSearch && (
                <button
                  onClick={() => setMobileSearchOpen((v) => !v)}
                  className="p-2.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:hidden shrink-0"
                >
                  <Search size={20} />
                </button>
              )}
              <Button variant="ghost" size="icon" onClick={toggle} className="rounded-full hover:bg-muted text-muted-foreground hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-error rounded-full text-[9px] font-bold text-[#fff]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
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
                          <p className="text-[10px] text-muted-foreground mt-1 font-medium">{timeAgo(n.createdAt)}</p>
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
                <button className="flex items-center gap-2 p-1.5 rounded-full hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Avatar className="h-10 w-10 ring-2 ring-primary/30">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                    <AvatarFallback className="bg-primary/20 text-primary-dark text-sm">
                      {getInitials(user?.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
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
                  <span>Alterar Foto de Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/app/settings')}>
                  <Settings size={15} />
                  <span>Configurações</span>
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

          {showSearch && mobileSearchOpen && (
            <form onSubmit={handleSearch} className="sm:hidden px-4 pb-3">
              <Input
                autoFocus
                type="text"
                placeholder="Pesquisar clientes..."
                icon={<Search />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:ring-primary/40"
              />
            </form>
          )}
        </header>

        {/* Page View */}
        <div className="flex-1 overflow-auto bg-background">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
