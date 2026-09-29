import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

// Extracts the best URL from share params.
// Chrome sends the shared URL in `url`; some apps stuff it into `text`.
function extractUrl(url: string, text: string): string {
  if (url) return url
  const match = text.match(/https?:\/\/[^\s]+/)
  return match ? match[0] : ''
}

export function ShareTargetPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    const sharedUrl = extractUrl(
      searchParams.get('url') ?? '',
      searchParams.get('text') ?? '',
    )

    if (!token) {
      // Not logged in — bounce to login, preserving the full share URL in ?next=
      const next = sharedUrl
        ? `/share-target?url=${encodeURIComponent(sharedUrl)}`
        : '/recipes/import'
      navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true })
      return
    }

    if (sharedUrl) {
      // Logged in + have a URL — go straight to import and auto-trigger
      navigate('/recipes/import', {
        replace: true,
        state: { sharedUrl, autoImport: true },
      })
    } else {
      // Logged in but no usable URL — open import page manually
      navigate('/recipes/import', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Show a spinner while the redirect happens (it's instant but avoids a flash)
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  )
}
