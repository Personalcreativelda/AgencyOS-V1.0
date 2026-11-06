import { useId, type CSSProperties } from 'react'
import type { IconBaseProps, IconType } from 'react-icons'
import {
  SiFacebook, SiInstagram, SiTiktok, SiYoutube, SiWhatsapp, SiX, SiMeta, SiGoogleads, SiGoogleanalytics,
} from 'react-icons/si'
// Simple Icons removed LinkedIn at the brand's request, so its official glyph comes from Font Awesome.
import { FaLinkedin } from 'react-icons/fa6'

/**
 * Official brand logos (Simple Icons / Font Awesome Brands) keyed by the platform codes used
 * across the API (social networks + ad/analytics integrations).
 */
export const BRAND_ICONS: Record<string, IconType> = {
  FACEBOOK: SiFacebook,
  INSTAGRAM: SiInstagram,
  LINKEDIN: FaLinkedin,
  TIKTOK: SiTiktok,
  YOUTUBE: SiYoutube,
  X: SiX,
  WHATSAPP: SiWhatsapp,
  META_ADS: SiMeta,
  GOOGLE_ADS: SiGoogleads,
  TIKTOK_ADS: SiTiktok,
  LINKEDIN_ADS: FaLinkedin,
  GOOGLE_ANALYTICS: SiGoogleanalytics,
}

/**
 * Official brand colors. TikTok and X are black/white brands, so they use `currentColor`
 * (the surrounding text color) to stay visible in both light and dark mode.
 */
export const BRAND_COLORS: Record<string, string> = {
  FACEBOOK: '#0866FF',
  INSTAGRAM: '#E4405F',
  LINKEDIN: '#0A66C2',
  TIKTOK: 'currentColor',
  YOUTUBE: '#FF0000',
  X: 'currentColor',
  WHATSAPP: '#25D366',
  META_ADS: '#0467DF',
  GOOGLE_ADS: '#4285F4',
  TIKTOK_ADS: 'currentColor',
  LINKEDIN_ADS: '#0A66C2',
  GOOGLE_ANALYTICS: '#E37400',
}

export function hasBrandIcon(platform: string) {
  return platform in BRAND_ICONS
}

interface BrandIconProps extends Omit<IconBaseProps, 'color'> {
  platform: string
  /** Paint the logo in its official color (default). `false` inherits the text color. */
  colored?: boolean
}

/** Renders a platform's official logo; Instagram gets its signature gradient when colored. */
export function BrandIcon({ platform, colored = true, style, ...props }: BrandIconProps) {
  const gradientId = useId().replace(/:/g, '')
  const Icon = BRAND_ICONS[platform]
  if (!Icon) return null

  if (colored && platform === 'INSTAGRAM') {
    return (
      <>
        <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
          <defs>
            <radialGradient id={gradientId} cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#FDF497" />
              <stop offset="5%" stopColor="#FDF497" />
              <stop offset="45%" stopColor="#FD5949" />
              <stop offset="60%" stopColor="#D6249F" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
        </svg>
        <Icon {...props} style={style} fill={`url(#${gradientId})`} />
      </>
    )
  }

  const color = colored ? BRAND_COLORS[platform] : undefined
  const merged: CSSProperties | undefined = color && color !== 'currentColor' ? { color, ...style } : style
  return <Icon {...props} style={merged} />
}

/** Builds a fixed-platform icon component, handy where an `icon` component prop is expected. */
export function brandIcon(platform: string, colored = true) {
  const Component = (props: IconBaseProps) => <BrandIcon platform={platform} colored={colored} {...props} />
  Component.displayName = `BrandIcon(${platform})`
  return Component
}
