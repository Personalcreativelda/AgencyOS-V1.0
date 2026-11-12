import { LogoMark } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'

/**
 * Brand signature shown on public pages (approval portal, reports) and on login: who makes
 * AgencyOS. One line on phones, never wraps mid-phrase.
 */
export function MadeBy({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'onBrand' }) {
  const onBrand = tone === 'onBrand'
  return (
    <p className={cn('flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs', onBrand ? 'text-[#fff]/70' : 'text-muted-foreground', className)}>
      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap font-semibold', onBrand ? 'text-[#fff]' : 'text-foreground/85')}>
        <LogoMark size={16} />
        <span translate="no">Agency<span className={onBrand ? 'text-[#5BE49B]' : 'text-primary'}>OS</span></span>
      </span>
      <span aria-hidden>·</span>
      <span className="whitespace-nowrap">
        um produto{' '}
        <a href="https://personalcreativemz.com" target="_blank" rel="noreferrer" translate="no"
          className={cn('font-semibold underline-offset-4 hover:underline', onBrand ? 'text-[#fff]' : 'text-foreground/85')}>
          Personalcreativelda
        </a>
      </span>
    </p>
  )
}
