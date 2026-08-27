import { STATUS_LABELS } from '@/lib/utils'
import { Badge, type BadgeProps } from './Badge'

interface StatusBadgeProps {
  status: string
  className?: string
}

const STATUS_VARIANTS: Record<string, BadgeProps['variant']> = {
  APPROVED: 'success',
  PUBLISHED: 'success',
  SCHEDULED: 'primary',
  IN_PRODUCTION: 'info',
  INTERNAL_REVIEW: 'secondary',
  CLIENT_REVIEW: 'warning',
  CHANGES_REQUESTED: 'error',
  FAILED: 'error',
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANTS[status] || 'default'} className={className}>
      {STATUS_LABELS[status] || status}
    </Badge>
  )
}
