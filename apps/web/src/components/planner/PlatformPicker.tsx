import { cn, PLATFORM_LABELS } from '@/lib/utils'
import { PlatformIcon } from './PlatformIcon'

interface PlatformPickerProps {
  value: string[]
  onChange: (platforms: string[]) => void
  className?: string
  disabled?: boolean
}

export function PlatformPicker({ value, onChange, className, disabled = false }: PlatformPickerProps) {
  const toggle = (platform: string) => {
    onChange(value.includes(platform) ? value.filter((p) => p !== platform) : [...value, platform])
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {Object.keys(PLATFORM_LABELS).map((platform) => {
        const active = value.includes(platform)
        return (
          <button
            key={platform}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => toggle(platform)}
            className={cn(
              'flex min-h-10 items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
              active
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-card border-border text-muted-foreground hover:border-grey-300'
            )}
          >
            <PlatformIcon platform={platform} size={13} />
            <span>{PLATFORM_LABELS[platform]}</span>
          </button>
        )
      })}
    </div>
  )
}
