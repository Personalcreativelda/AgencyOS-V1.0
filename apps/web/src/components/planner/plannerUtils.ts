import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, startOfDay,
} from 'date-fns'

export type TemporalState = 'overdue' | 'today' | 'future' | 'failed' | 'none'

export function getPrimaryImage(content: any): { publicUrl: string } | null {
  const images = (content.assets || [])
    .filter((a: any) => a.asset?.mimeType?.startsWith('image/'))
    .slice()
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return images[0]?.asset || null
}

export function getSlideCount(content: any): number {
  return (content.assets || []).filter((a: any) => a.asset?.mimeType?.startsWith('image/')).length
}

export function getTemporalState(content: any): TemporalState {
  if (content.status === 'FAILED') return 'failed'
  if (!content.scheduledAt) return 'none'
  const today = startOfDay(new Date())
  const day = startOfDay(new Date(content.scheduledAt))
  if (day.getTime() < today.getTime()) {
    return content.status === 'PUBLISHED' || content.status === 'ARCHIVED' ? 'none' : 'overdue'
  }
  if (day.getTime() === today.getTime()) return 'today'
  return 'future'
}

// Left-border accent per temporal state — deliberately subtle (low-opacity tokens, no saturated fills).
export const TEMPORAL_ACCENT: Record<TemporalState, string> = {
  overdue: 'border-l-2 border-l-error/60',
  today: 'border-l-2 border-l-primary/60',
  failed: 'border-l-2 border-l-error/60',
  future: 'border-l-2 border-l-transparent',
  none: 'border-l-2 border-l-transparent',
}

export function getMonthGridRange(date: Date) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  return { monthStart, gridStart, gridEnd, days: eachDayOfInterval({ start: gridStart, end: gridEnd }) }
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export interface BoardColumn {
  key: string
  label: string
  statuses: string[]
  targetStatus: string
}

// Fixed status→column mapping — NEVER user-editable. Agency.kanbanColumns only overrides
// label/order/hidden on top of this (see getBoardColumns below), so scheduling/publishing/
// approval automation tied to real Content.status values is never affected by customization.
export const BOARD_COLUMNS: BoardColumn[] = [
  { key: 'DRAFT', label: 'Rascunho', statuses: ['IDEA', 'DRAFT'], targetStatus: 'DRAFT' },
  { key: 'IN_PRODUCTION', label: 'Em Produção', statuses: ['IN_PRODUCTION', 'INTERNAL_REVIEW'], targetStatus: 'IN_PRODUCTION' },
  { key: 'CLIENT_REVIEW', label: 'Aguardando Cliente', statuses: ['CLIENT_REVIEW', 'CHANGES_REQUESTED'], targetStatus: 'CLIENT_REVIEW' },
  { key: 'APPROVED', label: 'Aprovado', statuses: ['APPROVED'], targetStatus: 'APPROVED' },
  { key: 'SCHEDULED', label: 'Agendado', statuses: ['SCHEDULED'], targetStatus: 'SCHEDULED' },
  { key: 'PUBLISHED', label: 'Publicado', statuses: ['PUBLISHED', 'FAILED', 'ARCHIVED'], targetStatus: 'PUBLISHED' },
]

export interface KanbanColumnConfig {
  key: string
  label: string
  order: number
  hidden: boolean
}

export interface EffectiveBoardColumn extends BoardColumn {
  hidden: boolean
}

// Parses Agency.kanbanColumns (JSON string or null/undefined). Any parse failure or absence
// is treated as "no customization saved" — callers fall back to BOARD_COLUMNS unchanged.
export function parseKanbanColumns(raw: string | null | undefined): KanbanColumnConfig[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Merges saved label/order/hidden overrides onto BOARD_COLUMNS. statuses/targetStatus always
// come from BOARD_COLUMNS, never from overrides. No saved config → BOARD_COLUMNS unchanged.
export function getBoardColumns(overrides: KanbanColumnConfig[]): EffectiveBoardColumn[] {
  if (!overrides.length) return BOARD_COLUMNS.map((c) => ({ ...c, hidden: false }))

  const byKey = new Map(overrides.map((o) => [o.key, o]))
  return BOARD_COLUMNS
    .map((col, i) => {
      const o = byKey.get(col.key)
      return {
        ...col,
        label: o?.label?.trim() || col.label,
        hidden: o?.hidden ?? false,
        _order: o?.order ?? i,
      }
    })
    .sort((a, b) => a._order - b._order)
    .map(({ _order, ...rest }) => rest)
}

// Visible columns for the board grid — hidden ones are still returned by getBoardColumns so
// the customization modal can list/restore them.
export function getVisibleBoardColumns(overrides: KanbanColumnConfig[]): EffectiveBoardColumn[] {
  return getBoardColumns(overrides).filter((c) => !c.hidden)
}
