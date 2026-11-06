/**
 * One visual spec for every form control (Input, Textarea, SelectTrigger, DateTimeField):
 * same border, radius, type size, hover, focus ring and disabled/invalid states, so fields
 * line up perfectly when mixed in a row or a modal.
 */
export const fieldBase =
  'w-full rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-grey-400 ' +
  'focus:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 ' +
  'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 disabled:hover:border-border ' +
  'aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:ring-error/15'

/** Single-line controls share a fixed 40px height. */
export const fieldHeight = 'h-10'
