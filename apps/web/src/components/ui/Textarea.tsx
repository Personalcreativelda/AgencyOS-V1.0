import * as React from 'react'
import { cn } from '@/lib/utils'
import { fieldBase } from './field'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          fieldBase,
          'min-h-[80px] resize-y px-3.5 py-2.5 leading-relaxed',
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'
