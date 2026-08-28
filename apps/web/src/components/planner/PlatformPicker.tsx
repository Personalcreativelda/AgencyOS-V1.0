import { cn, PLATFORM_LABELS } from '@/lib/utils'
import { PlatformIcon } from './PlatformIcon'

interface PlatformPickerProps {
  value: string[]
  onChange: (platforms: string[]) => void
  className?: string
}

export function PlatformPicker({ value, onChange, className }: PlatformPickerProps) {
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
            onClick={() => toggle(platform)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors',
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
