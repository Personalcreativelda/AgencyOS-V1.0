import * as React from 'react'
import { cn } from '@/lib/utils'
import { fieldBase, fieldHeight } from './field'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  endAdornment?: React.ReactNode
}

const FIELD = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not(:disabled), textarea:not(:disabled), select:not(:disabled), button[role=combobox]:not(:disabled)'

function nextField(el: HTMLElement): HTMLElement | null {
  const form = el.closest('form')
  if (!form) return null
  const fields = [...form.querySelectorAll<HTMLElement>(FIELD)].filter((f) => f.offsetParent !== null)
  return fields[fields.indexOf(el) + 1] || null
}

/**
 * Mobile keyboard flow, like native forms: the keyboard's action key reads "Seguinte" while
 * there are more fields and Enter moves to the next one; on the last field it submits.
 * Custom onKeyDown / enterKeyHint props always win.
 */
function keyboardFlow(props: React.InputHTMLAttributes<HTMLInputElement>) {
  if (props.onKeyDown || props.type === 'search') return { enterKeyHint: props.enterKeyHint ?? (props.type === 'search' ? 'search' as const : undefined) }
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      if (!props.enterKeyHint) e.currentTarget.enterKeyHint = nextField(e.currentTarget) ? 'next' : 'done'
      props.onFocus?.(e)
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
      const next = nextField(e.currentTarget)
      if (next) { e.preventDefault(); next.focus() }
    },
  }
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, endAdornment, ...props }, ref) => {
    const flow = keyboardFlow(props)
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
            {...flow}
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
        {...flow}
      />
    )
  }
)
Input.displayName = 'Input'
