import { PLATFORM_COLORS, PLATFORM_LABELS } from '@/lib/utils'
import { BrandIcon, hasBrandIcon } from '@/components/brand/BrandIcon'

interface PlatformIconProps {
  platform: string
  size?: number
  className?: string
}

export function PlatformIcon({ platform, size = 13, className }: PlatformIconProps) {
  const label = PLATFORM_LABELS[platform] || platform

  if (hasBrandIcon(platform)) {
    return (
      <span title={label} className={className}>
        <BrandIcon platform={platform} size={size} />
      </span>
    )
  }

  // Unknown platform — fall back to a colored initial dot.
  const color = PLATFORM_COLORS[platform] || '#8E33FF'
  return (
    <span
      title={label}
      className={className}
      style={{
        width: size, height: size, borderRadius: '9999px', backgroundColor: color,
        color: '#fff', fontSize: size * 0.6, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
      }}
    >
      {label[0]}
    </span>
  )
}
