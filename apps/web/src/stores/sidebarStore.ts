import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  /** Desktop only: shrink the sidebar to an icon rail. */
  collapsed: boolean
  /** Closed categories / sub-menus, keyed by id. Anything not listed is open. */
  closed: Record<string, boolean>
  toggleCollapsed: () => void
  toggleGroup: (id: string) => void
  openGroup: (id: string) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      closed: { ads: true, integrations: true },
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      toggleGroup: (id) => set((s) => ({ closed: { ...s.closed, [id]: !s.closed[id] } })),
      openGroup: (id) => set((s) => (s.closed[id] ? { closed: { ...s.closed, [id]: false } } : s)),
    }),
    {
      name: 'agencyos-sidebar',
      version: 2,
      migrate: (persisted) => {
        const previous = persisted as Partial<SidebarState>
        return { ...previous, closed: { ...previous.closed, ads: true, integrations: true } }
      },
    }
  )
)
