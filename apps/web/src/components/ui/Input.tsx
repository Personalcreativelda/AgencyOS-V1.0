import * as React from 'react'
import { cn } from '@/lib/utils'
import { fieldBase, fieldHeight } from './field'

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
            <span className="pointer-events-none absolute left-3.5 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground [&>svg]:size-4">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              fieldBase,
              fieldHeight,
              icon ? 'pl-10' : 'pl-3.5',
              endAdornment ? 'pr-10' : 'pr-3.5',
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
        className={cn(fieldBase, fieldHeight, 'px-3.5', className)}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'
