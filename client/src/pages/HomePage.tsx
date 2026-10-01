import { BrandMark } from '../components/shared/BrandMark'
import { useEffect, useState } from 'react'

type ServerStatus = 'loading' | 'ok' | 'error'

export function HomePage() {
  const [status, setStatus] = useState<ServerStatus>('loading')

  useEffect(() => {
    fetch('/api/health') // proxied to http://localhost:3000/health
      .then((res) => res.json())
      .then((data) => setStatus(data.ok ? 'ok' : 'error'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <BrandMark />
        <h1 className="text-3xl font-headline font-bold text-on-surface">Food Prep</h1>
        <p className="mt-2 text-gray-500 text-sm">Smart shopping and meal planning for families</p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Server:</span>
        {status === 'loading' && (
          <span className="text-gray-400">Checking…</span>
        )}
        {status === 'ok' && (
          <span className="text-primary font-medium">✓ OK</span>
        )}
        {status === 'error' && (
          <span className="text-red-500 font-medium">✗ Offline</span>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">Phase 1 scaffold — features coming soon</p>
    </div>
  )
}
