import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  /** 'md' = ~50vh, 'lg' = ~80vh, 'full' = ~95vh */
  size?: 'sm' | 'md' | 'lg' | 'full'
}

const sizeClasses = {
  sm: 'max-h-[40vh]',
  md: 'max-h-[60vh]',
  lg: 'max-h-[85vh]',
  full: 'max-h-[95vh]',
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 sheet-backdrop"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl shadow-card-md flex flex-col ${sizeClasses[size]} animate-slide-up`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-outline-variant" />
        </div>

        {title && (
          <div className="px-6 py-3 flex-shrink-0">
            <h2 className="font-headline font-bold text-lg text-on-surface">{title}</h2>
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
