import { cn } from '@/lib/utils'

// A native `<input type="datetime-local">`'s displayed time format (12h AM/PM vs 24h) is
// rendered by the browser/OS locale, not by this app — setting `lang` on the element is a weak
// signal some browsers ignore, so agencies outside the US kept seeing AM/PM regardless of their
// own locale. This builds the hour/minute picker from plain `<select>`s instead, which always
// render exactly "14:30", independent of the visitor's OS regional settings.
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

// Converts a Date/ISO instant to the naive 'YYYY-MM-DDTHH:mm' shape this field (and native
// datetime-local inputs) use, in the *browser's local* time — not UTC. `date.toISOString()`
// always returns UTC regardless of the viewer's timezone, so using it here was the bug: an
// agency outside UTC would see (and silently keep resaving) an hour shifted by their own
// timezone offset every time an existing value round-tripped through the field, and picking a
// new hour would immediately appear to "snap back" to a different one. Pair with `new
// Date(value)` (or `new Date(value).toISOString()` when sending to the API) to convert back —
// the native Date constructor already correctly treats a naive string as local time.
export function toDateTimeLocalValue(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fieldClass =
  'bg-card border border-border rounded-xl px-3 py-2.5 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors disabled:opacity-50 disabled:bg-muted'

interface DateTimeFieldProps {
  id?: string
  /** '' or 'YYYY-MM-DDTHH:mm', same shape a native datetime-local input produces. */
  value: string
  onChange: (value: string) => void
  className?: string
}

export function DateTimeField({ id, value, onChange, className }: DateTimeFieldProps) {
  const [datePart, timePart] = value ? value.split('T') : ['', '']
  const hour = timePart?.slice(0, 2) || '09'
  const minute = timePart?.slice(3, 5) || '00'

  const handleDate = (d: string) => onChange(d ? `${d}T${hour}:${minute}` : '')
  const handleHour = (h: string) => { if (datePart) onChange(`${datePart}T${h}:${minute}`) }
  const handleMinute = (m: string) => { if (datePart) onChange(`${datePart}T${hour}:${m}`) }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        id={id}
        type="date"
        value={datePart}
        onChange={(e) => handleDate(e.target.value)}
        className={cn(fieldClass, 'flex-1 min-w-0')}
      />
      <select
        aria-label="Hora"
        value={hour}
        disabled={!datePart}
        onChange={(e) => handleHour(e.target.value)}
        className={fieldClass}
      >
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-muted-foreground font-bold">:</span>
      <select
        aria-label="Minuto"
        value={minute}
        disabled={!datePart}
        onChange={(e) => handleMinute(e.target.value)}
        className={fieldClass}
      >
        {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  )
}
