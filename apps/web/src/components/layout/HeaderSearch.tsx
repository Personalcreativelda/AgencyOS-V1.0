import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

/**
 * Desktop top-bar search (Stitch dashboard). Searches clients through the existing
 * `/app/clients?q=` filter. Ctrl/⌘ + K focuses it from anywhere.
 */
export function HeaderSearch() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const q = query.trim()
        navigate(q ? `/app/clients?q=${encodeURIComponent(q)}` : '/app/clients')
        inputRef.current?.blur()
      }}
      className="relative hidden w-full max-w-[380px] lg:block"
    >
      <Search size={17} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar clientes…"
        aria-label="Buscar clientes"
        className="h-10 w-full rounded-full border border-border bg-muted/50 pl-10 pr-14 text-sm text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color] hover:border-grey-400 focus:bg-card focus:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </form>
  )
}
