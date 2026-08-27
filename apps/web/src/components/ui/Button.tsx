import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        solid: 'bg-primary hover:bg-primary-dark text-[#fff]',
        dark: 'bg-[#0a0a0a] hover:bg-[#1a1a1a] text-[#fff]',
        soft: 'bg-primary/10 hover:bg-primary/15 text-primary',
        outline: 'border border-grey-200 hover:bg-grey-100 text-grey-700 bg-white',
        subtle: 'bg-muted hover:bg-grey-200 text-foreground',
        ghost: 'text-grey-500 hover:text-grey-800 hover:bg-grey-100',
        destructive: 'bg-error hover:bg-error-dark text-[#fff]',
      },
      size: {
        sm: 'px-3 py-2',
        md: 'px-4 py-2.5',
        lg: 'px-5 py-3',
        icon: 'p-2.5',
      },
    },
    defaultVariants: {
      variant: 'solid',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...(!asChild ? { disabled: disabled || loading } : {})}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'
