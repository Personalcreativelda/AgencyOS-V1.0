import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import type { ComponentType } from 'react'

/**
 * Floating "create" button for phones, only on pages that create something (Conteúdos, Clientes,
 * Relatórios…). Sits bottom-right above the tab bar; hidden from `lg` up, where the page header
 * shows the full button instead.
 */
export function PageFab({ label, onClick, icon: Icon = Plus }: {
  label: string
  onClick: () => void
  icon?: ComponentType<{ size?: number | string; strokeWidth?: number | string }>
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-[#fff] shadow-[0_10px_24px_-6px_rgba(0,120,103,0.55)] transition-transform hover:bg-primary-dark active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 lg:hidden"
      style={{ bottom: 'calc(4rem + var(--sab) + 1rem)' }}
    >
      <Icon size={26} strokeWidth={2.2} />
    </button>,
    document.body,
  )
}
