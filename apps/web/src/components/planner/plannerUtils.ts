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

export function getWeekRange(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return { start, end, days: eachDayOfInterval({ start, end }) }
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

interface BoardColumn {
  key: string
  label: string
  statuses: string[]
  targetStatus: string
}

export const BOARD_COLUMNS: BoardColumn[] = [
  { key: 'DRAFT', label: 'Rascunho', statuses: ['IDEA', 'DRAFT'], targetStatus: 'DRAFT' },
  { key: 'IN_PRODUCTION', label: 'Em Produção', statuses: ['IN_PRODUCTION', 'INTERNAL_REVIEW'], targetStatus: 'IN_PRODUCTION' },
  { key: 'CLIENT_REVIEW', label: 'Aguardando Cliente', statuses: ['CLIENT_REVIEW', 'CHANGES_REQUESTED'], targetStatus: 'CLIENT_REVIEW' },
  { key: 'APPROVED', label: 'Aprovado', statuses: ['APPROVED'], targetStatus: 'APPROVED' },
  { key: 'SCHEDULED', label: 'Agendado', statuses: ['SCHEDULED'], targetStatus: 'SCHEDULED' },
  { key: 'PUBLISHED', label: 'Publicado', statuses: ['PUBLISHED', 'FAILED', 'ARCHIVED'], targetStatus: 'PUBLISHED' },
]
