import { useEffect, useRef, useState } from 'react'
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
  const drag = useRef<{ startY: number; samples: { y: number; t: number }[] } | null>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Pointer-driven dismissal: track 1:1, project momentum, decide by where it's headed
  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, samples: [{ y: e.clientY, t: performance.now() }] }
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    d.samples.push({ y: e.clientY, t: performance.now() })
    if (d.samples.length > 5) d.samples.shift()
    const dy = e.clientY - d.startY
    // Rubber-band when pulling up past the resting position
    setOffset(dy >= 0 ? dy : (dy * 0.55) / (1 + Math.abs(dy) * 0.012))
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d) return
    const first = d.samples[0]
    const last = d.samples[d.samples.length - 1]
    const velocity = last.t > first.t ? ((last.y - first.y) / (last.t - first.t)) * 1000 : 0 // px/s
    const projected = offset + (velocity / 1000) * 0.998 / (1 - 0.998) * 0.2
    const height = sheetRef.current?.offsetHeight ?? 400
    if (projected > height * 0.4) {
      setLeaving(true)
      setOffset(height)
      window.setTimeout(() => {
        onClose()
        setLeaving(false)
        setOffset(0)
      }, 260)
    } else {
      setOffset(0)
    }
  }

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
        className={`absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl shadow-[0_-8px_40px_-8px_rgba(26,26,26,0.22)] flex flex-col ${sizeClasses[size]} animate-slide-up`}
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
          transform: offset ? `translateY(${offset}px)` : undefined,
          transition: dragging ? 'none' : `transform ${leaving ? 260 : 420}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
      >
        {/* Drag handle — grab area is generous, touch-action none so the sheet follows the finger */}
        <div
          className="flex justify-center pt-3 pb-3 -mb-2 flex-shrink-0 cursor-grab touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
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
