import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  endAdornment?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, endAdornment, ...props }, ref) => {
    if (icon || endAdornment) {
      return (
        <div className="relative">
          {icon && (
            <span className="w-4 h-4 text-grey-400 absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-card border border-border rounded-xl py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors disabled:opacity-50 disabled:bg-muted',
              icon ? 'pl-10' : 'pl-4',
              endAdornment ? 'pr-10' : 'pr-4',
              className
            )}
            {...props}
          />
          {endAdornment && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
              {endAdornment}
            </span>
          )}
        </div>
      )
    }

    return (
      <input
        ref={ref}
        className={cn(
          'w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors disabled:opacity-50 disabled:bg-muted',
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'
