import * as React from 'react'
import { cn } from '@/lib/utils'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors disabled:opacity-50 disabled:bg-muted resize-none',
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'
