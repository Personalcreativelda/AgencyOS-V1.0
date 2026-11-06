import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-semibold leading-5 transition-colors', {
  variants: {
    variant: {
      default: 'label-soft-default',
      primary: 'label-soft-primary',
      secondary: 'label-soft-secondary',
      info: 'label-soft-info',
      success: 'label-soft-success',
      warning: 'label-soft-warning',
      error: 'label-soft-error',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Leading status dot in the badge colour. */
  dot?: boolean
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  )
}
