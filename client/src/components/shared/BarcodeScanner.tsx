import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'

interface Props {
  onDetect: (text: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cancelled = false

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err, controls) => {
        controlsRef.current = controls ?? null
        if (cancelled) return
        if (result) {
          onDetect(result.getText())
        }
        if (err && err.name !== 'NotFoundException') {
          setError('Camera error. Try again.')
        }
      })
      .catch(() => setError('Could not access camera. Make sure HTTPS is enabled.'))

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [onDetect])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 safe-top">
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-white">close</span>
        </button>
        <p className="text-white font-headline font-bold">Scan barcode</p>
        <div className="w-10" />
      </div>

      {/* Viewfinder */}
      <div className="flex-1 relative flex items-center justify-center">
        <video ref={videoRef} className="w-full h-full object-cover" />

        {/* Targeting overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-40 relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
            <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-primary/60 animate-pulse" />
          </div>
        </div>

        {error && (
          <div className="absolute bottom-8 left-4 right-4 bg-error text-on-error text-sm text-center py-3 px-4 rounded-2xl">
            {error}
          </div>
        )}
      </div>

      <p className="text-white/60 text-center text-sm pb-8 safe-bottom">
        Point at a barcode to scan
      </p>
    </div>
  )
}
