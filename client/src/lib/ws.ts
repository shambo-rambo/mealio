// Reconnecting WebSocket client
// Connects once the user is logged in; auto-reconnects on disconnect.

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let connectTimer: ReturnType<typeof setTimeout> | null = null
let active = false
let retryCount = 0
const MAX_RETRIES = 10
const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

type MessageHandler = (data: unknown) => void
const handlers = new Set<MessageHandler>()

export function onWsMessage(fn: MessageHandler) {
  handlers.add(fn)
  return () => handlers.delete(fn)
}

function getWsUrl(token: string): string {
  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  if (apiBase) {
    // Production: VITE_API_URL = https://mealio-api.xxx.workers.dev
    const wsBase = apiBase.replace(/^http/, 'ws')
    return `${wsBase}/ws?token=${encodeURIComponent(token)}`
  }
  // Local dev: connect directly to wrangler on 8787 to avoid Vite proxy issues
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://localhost:8787/ws?token=${encodeURIComponent(token)}`
}

function connect(token: string) {
  if (socket && socket.readyState === WebSocket.OPEN) return

  socket = new WebSocket(getWsUrl(token))

  socket.onopen = () => {
    retryCount = 0
  }

  socket.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data as string)
      for (const handler of handlers) handler(data)
    } catch { /* ignore */ }
  }

  socket.onclose = (event) => {
    socket = null
    // Application-defined auth failure codes (RFC 6455 §7.4.2).
    // 4401 = invalid/expired token, 4403 = no family.
    // Do not reconnect — dispatch an event so the app can clear auth.
    if (event.code === 4401 || event.code === 4403) {
      active = false
      window.dispatchEvent(new CustomEvent('ws:auth-failed', { detail: { code: event.code, reason: event.reason } }))
      return
    }
    if (active && retryCount < MAX_RETRIES) {
      const delay = Math.min(BASE_DELAY_MS * 2 ** retryCount, MAX_DELAY_MS)
      retryCount++
      reconnectTimer = setTimeout(() => {
        const t = localStorage.getItem('mealio_token')
        if (t) connect(t)
      }, delay)
    }
  }

  socket.onerror = () => { /* browser fires onclose automatically after error */ }
}

export function startWs(token: string) {
  active = true
  retryCount = 0
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (connectTimer) clearTimeout(connectTimer)
  // Defer one event-loop tick so React StrictMode's synchronous cleanup can
  // cancel this before the WebSocket is created. Without this, StrictMode's
  // mount→cleanup→mount cycle closes a CONNECTING socket, which the browser
  // always logs as an error (per the WebSocket spec, §7.1.2).
  connectTimer = setTimeout(() => {
    connectTimer = null
    connect(token)
  }, 0)
}

export function stopWs() {
  active = false
  if (connectTimer) { clearTimeout(connectTimer); connectTimer = null }
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (socket) {
    socket.onclose = null
    socket.onerror = null
    socket.close()
    socket = null
  }
}
