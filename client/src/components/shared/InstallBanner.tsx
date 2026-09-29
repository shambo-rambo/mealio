import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'mealio_install_dismissed'
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isDismissed() {
  const val = localStorage.getItem(DISMISS_KEY)
  if (!val) return false
  return Date.now() - Number(val) < DISMISS_TTL_MS
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  )
}

function isIosSafari() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    /safari/i.test(navigator.userAgent) &&
    !/chrome|crios|fxios/i.test(navigator.userAgent)
  )
}

// Chrome on Android (including when beforeinstallprompt is in cooldown)
function isAndroidChrome() {
  return /android/i.test(navigator.userAgent) && /chrome/i.test(navigator.userAgent)
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<'chrome-native' | 'chrome-manual' | 'ios' | null>(null)

  useEffect(() => {
    if (isStandalone() || isDismissed()) return

    if (isIosSafari()) {
      setMode('ios')
      setVisible(true)
      return
    }

    if (isAndroidChrome()) {
      // Always show the banner on Android Chrome — Chrome fires beforeinstallprompt
      // inconsistently due to engagement thresholds and post-uninstall cooldowns.
      // Start with manual instructions; upgrade to native prompt if the event fires.
      setMode('chrome-manual')
      setVisible(true)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setMode('chrome-native')
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    setDeferredPrompt(null)
  }

  if (!visible || !mode) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-on-primary px-4 py-3 flex items-center gap-3 shadow-lg">
      <span
        className="material-symbols-outlined text-[22px] flex-shrink-0"
        style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
      >
        install_mobile
      </span>

      <p className="flex-1 text-sm font-medium leading-tight">
        {mode === 'ios' && (
          <>Tap <strong>Share</strong> <span className="material-symbols-outlined text-[13px] align-middle">ios_share</span> then <strong>"Add to Home Screen"</strong></>
        )}
        {mode === 'chrome-native' && (
          <>Install <strong>Cook</strong> for the best experience</>
        )}
        {mode === 'chrome-manual' && (
          <>Tap <strong>⋮</strong> then <strong>"Add to Home screen"</strong> to install</>
        )}
      </p>

      {mode === 'chrome-native' && (
        <button
          onClick={install}
          className="flex-shrink-0 bg-on-primary text-primary text-sm font-bold px-3 py-1.5 rounded-full"
        >
          Install
        </button>
      )}

      <button onClick={dismiss} aria-label="Dismiss" className="flex-shrink-0 opacity-70 hover:opacity-100">
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  )
}
