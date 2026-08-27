import * as React from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-16 px-4 border border-border rounded-2xl bg-muted/40', className)}>
      <Icon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" strokeWidth={1.5} />
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
