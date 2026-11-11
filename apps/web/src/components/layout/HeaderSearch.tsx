import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  Activity, BadgeCheck, CalendarRange, FileBarChart, FileText, Kanban, LayoutDashboard, PanelsTopLeft,
  Search, Settings, Share2, Users, CornerDownLeft,
} from 'lucide-react'
import { cachedGet } from '@/lib/api'
import { brandIcon } from '@/components/brand/BrandIcon'
import { cn } from '@/lib/utils'

type Icon = ComponentType<{ size?: number | string; className?: string }>
type Group = 'Recentes' | 'Clientes' | 'Conteúdos' | 'Páginas'
type Result = { id: string; group: Group; label: string; hint?: string; to: string; icon: Icon }
type Recent = { id: string; kind: 'Clientes' | 'Conteúdos' | 'Páginas'; label: string; hint?: string; to: string }

const RECENTS_KEY = 'agencyos-recent-search'
function readRecents(): Recent[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]') } catch { return [] }
}
function saveRecent(r: Recent) {
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify([r, ...readRecents().filter((x) => x.id !== r.id)].slice(0, 5))) } catch { /* private mode */ }
}

const PAGES: { label: string; to: string; icon: Icon; keywords?: string }[] = [
  { label: 'Dashboard', to: '/app/dashboard', icon: LayoutDashboard, keywords: 'inicio visao geral' },
  { label: 'Performance', to: '/app/performance', icon: Activity, keywords: 'metricas resultados' },
  { label: 'Clientes', to: '/app/clients', icon: Users },
  { label: 'Novo cliente', to: '/app/clients/new', icon: Users, keywords: 'criar adicionar' },
  { label: 'Aprovações', to: '/app/approvals', icon: BadgeCheck },
  { label: 'Relatórios mensais', to: '/app/reports', icon: FileBarChart },
  { label: 'Conteúdos', to: '/app/content', icon: PanelsTopLeft, keywords: 'biblioteca posts' },
  { label: 'Novo conteúdo', to: '/app/content?novo=1', icon: PanelsTopLeft, keywords: 'criar post' },
  { label: 'Planner', to: '/app/content/calendar', icon: CalendarRange, keywords: 'calendario agenda' },
  { label: 'Kanban', to: '/app/content/board', icon: Kanban, keywords: 'quadro' },
  { label: 'Meta Ads', to: '/app/ads', icon: brandIcon('META_ADS') as Icon, keywords: 'facebook instagram anuncios campanhas' },
  { label: 'Google Ads e Analytics', to: '/app/google', icon: brandIcon('GOOGLE_ADS') as Icon, keywords: 'ga4 anuncios' },
  { label: 'TikTok Ads', to: '/app/tiktok-ads', icon: brandIcon('TIKTOK_ADS') as Icon },
  { label: 'LinkedIn Ads', to: '/app/linkedin-ads', icon: brandIcon('LINKEDIN_ADS') as Icon },
  { label: 'Redes sociais', to: '/app/social', icon: Share2, keywords: 'conexoes integracoes whatsapp' },
  { label: 'Configurações', to: '/app/settings', icon: Settings, keywords: 'equipe agencia ia' },
]

const OPEN_EVENT = 'agencyos:open-search'
/** Opens the global search from anywhere (sidebar, header…). */
export const openGlobalSearch = () => window.dispatchEvent(new Event(OPEN_EVENT))
const shortcutLabel = () => (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K')

/** Sidebar trigger: full field under the logo, or just the magnifier on the collapsed rail. */
export function SearchTrigger({ rail = false }: { rail?: boolean }) {
  if (rail) {
    return (
      <button type="button" onClick={openGlobalSearch} aria-label={`Pesquisar (${shortcutLabel()})`} title={`Pesquisar (${shortcutLabel()})`}
        className="mx-auto flex size-12 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <Search size={21} />
      </button>
    )
  }
  return (
    <button type="button" onClick={openGlobalSearch} aria-label="Pesquisar"
      className="flex h-10 w-full items-center gap-2 rounded-xl border border-sidebar-border bg-card/60 pl-3 pr-2 text-sm text-muted-foreground transition-colors hover:border-grey-400 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
      <Search size={16} aria-hidden />
      <span className="flex-1 text-left">Pesquisar…</span>
      <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium">{shortcutLabel()}</kbd>
    </button>
  )
}

/** Lowercase without accents, so "aprovacao" finds "Aprovação". */
const norm = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Global search (Ctrl/⌘ K), Stripe/Linear style: one place to jump to any client, content or
 * page. Uses the same read endpoints the app already loads (cached), no new API.
 */
export function HeaderSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [clients, setClients] = useState<any[]>([])
  const [contents, setContents] = useState<any[]>([])
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(OPEN_EVENT, onOpen) }
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    cachedGet('/clients').then(({ data }) => setClients(data?.data || [])).catch(() => {})
    cachedGet('/contents', { params: { limit: 100 } }).then(({ data }) => setContents(data?.data || [])).catch(() => {})
  }, [open])

  const results = useMemo<Result[]>(() => {
    const q = norm(query.trim())
    const has = (...parts: (string | undefined)[]) => !q || norm(parts.filter(Boolean).join(' ')).includes(q)
    const pages = PAGES.filter((p) => has(p.label, p.keywords)).map((p) => ({ id: `p-${p.to}`, group: 'Páginas' as const, label: p.label, to: p.to, icon: p.icon }))
    if (!q) {
      // Never a blank search: last opened items first, then the main pages.
      const recents = readRecents().map((r) => ({
        id: `r-${r.id}`, group: 'Recentes' as const, label: r.label, hint: r.hint, to: r.to,
        icon: r.kind === 'Clientes' ? Users : r.kind === 'Conteúdos' ? FileText : (PAGES.find((p) => p.to === r.to)?.icon || Search),
      }))
      return [...recents, ...pages.filter((p) => !recents.some((r) => r.to === p.to)).slice(0, 6)]
    }
    const cl = clients.filter((c) => has(c.name, c.segment)).slice(0, 5)
      .map((c) => ({ id: `c-${c.id}`, group: 'Clientes' as const, label: c.name, hint: c.segment, to: `/app/clients/${c.id}`, icon: Users }))
    const co = contents.filter((c) => has(c.title, c.client?.name, c.caption)).slice(0, 6)
      .map((c) => ({ id: `t-${c.id}`, group: 'Conteúdos' as const, label: c.title, hint: c.client?.name, to: `/app/content/${c.id}`, icon: FileText }))
    return [...cl, ...co, ...pages.slice(0, 5)]
  }, [query, clients, contents, open])

  useEffect(() => { setActive(0) }, [query])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const go = (result?: Result) => {
    if (!result) return
    const kind = result.group === 'Recentes' ? undefined : result.group
    saveRecent({ id: result.id.replace(/^r-/, ''), kind: kind || (result.to.startsWith('/app/clients/') ? 'Clientes' : result.to.startsWith('/app/content/') && !/calendar|board/.test(result.to) ? 'Conteúdos' : 'Páginas'), label: result.label, hint: result.hint, to: result.to })
    setOpen(false)
    navigate(result.to)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {/* Phones: magnifier in the header (the sidebar, with the full field, is hidden there) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Pesquisar"
        className="flex size-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
      >
        <Search size={20} />
      </button>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#000]/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[max(1rem,var(--sat))] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-dialog focus:outline-none sm:top-[12vh]"
        >
          <DialogPrimitive.Title className="sr-only">Pesquisar no AgencyOS</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search size={18} aria-hidden className="shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)) }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
                if (e.key === 'Enter') { e.preventDefault(); go(results[active]) }
              }}
              placeholder="Pesquisar clientes, conteúdos e páginas…"
              aria-label="Pesquisar clientes, conteúdos e páginas"
              role="combobox"
              aria-expanded="true"
              aria-controls="global-search-results"
              aria-activedescendant={results[active] ? `gs-${results[active].id}` : undefined}
              className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground sm:block">Esc</kbd>
          </div>

          <ul id="global-search-results" ref={listRef} role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            {results.length === 0 && <li className="px-3 py-10 text-center text-sm text-muted-foreground">Nada encontrado para "{query}".</li>}
            {results.map((r, i) => (
              <li key={r.id} role="presentation">
                {(i === 0 || results[i - 1].group !== r.group) && (
                  <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-1">{r.group}</p>
                )}
                <button
                  type="button"
                  id={`gs-${r.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(r)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors', i === active ? 'bg-muted text-foreground' : 'text-foreground/85')}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground"><r.icon size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.label}</span>
                    {r.hint && <span className="block truncate text-xs text-muted-foreground">{r.hint}</span>}
                  </span>
                  {i === active && <CornerDownLeft size={14} aria-hidden className="shrink-0 text-muted-foreground" />}
                </button>
              </li>
            ))}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
