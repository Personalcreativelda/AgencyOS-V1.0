import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold capitalize transition-colors', {
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

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
