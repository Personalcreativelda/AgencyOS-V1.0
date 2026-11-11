import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore, type ThemePreference } from '@/stores/themeStore'
import { Button } from './Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './DropdownMenu'

const OPTIONS = [
  { value: 'system', label: 'Sistema', icon: Monitor },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
] as const

export function ThemeMenu() {
  const { mode, preference, setMode } = useThemeStore()
  const Icon = preference === 'system' ? Monitor : mode === 'dark' ? Moon : Sun
  const selected = OPTIONS.find(option => option.value === preference)!
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Tema: ${selected.label}`} title={`Tema: ${selected.label}`} className="size-12 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground lg:size-10">
          <Icon size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>Aparência</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(option => (
          <DropdownMenuItem key={option.value} role="menuitemradio" aria-checked={preference === option.value} onSelect={() => setMode(option.value as ThemePreference)}>
            <option.icon size={15} aria-hidden />
            <span className="flex-1">{option.label}</span>
            {preference === option.value && <Check size={14} className="text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
