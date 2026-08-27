import * as React from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadableAvatarProps {
  src?: string | null
  fallback: React.ReactNode
  onUpload: (file: File) => Promise<void>
  className?: string
  rounded?: string
  disabled?: boolean
}

export function UploadableAvatar({ src, fallback, onUpload, className, rounded = 'rounded-full', disabled }: UploadableAvatarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <button
      type="button"
      disabled={disabled || uploading}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'relative group shrink-0 overflow-hidden bg-muted flex items-center justify-center border border-border transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        rounded,
        className
      )}
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : fallback}

      <div className={cn('absolute inset-0 flex items-center justify-center bg-[#000]/50 transition-opacity', uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
        {uploading ? <Loader2 size={16} className="text-[#fff] animate-spin" /> : <Camera size={16} className="text-[#fff]" />}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </button>
  )
}
