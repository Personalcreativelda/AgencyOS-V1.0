import { Instagram, Facebook, Youtube, Linkedin, Twitter } from 'lucide-react'
import { PLATFORM_COLORS, PLATFORM_LABELS } from '@/lib/utils'

const ICONS: Record<string, typeof Instagram> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  YOUTUBE: Youtube,
  LINKEDIN: Linkedin,
  X: Twitter,
}

interface PlatformIconProps {
  platform: string
  size?: number
  className?: string
}

export function PlatformIcon({ platform, size = 13, className }: PlatformIconProps) {
  const Icon = ICONS[platform]
  const color = PLATFORM_COLORS[platform] || '#8E33FF'
  const label = PLATFORM_LABELS[platform] || platform

  if (Icon) {
    return (
      <span title={label} className={className}>
        <Icon size={size} style={{ color }} />
      </span>
    )
  }

  // No lucide icon for this platform (e.g. TikTok) — fall back to a colored initial dot.
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
