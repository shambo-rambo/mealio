// Reconnecting WebSocket client
// Connects once the user is logged in; auto-reconnects on disconnect.

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let active = false

type MessageHandler = (data: unknown) => void
const handlers = new Set<MessageHandler>()

export function onWsMessage(fn: MessageHandler) {
  handlers.add(fn)
  return () => handlers.delete(fn)
}

function connect(token: string) {
  if (socket && socket.readyState === WebSocket.OPEN) return

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host // includes port, e.g. localhost:5173 in dev
  socket = new WebSocket(`${protocol}://${host}/ws?token=${encodeURIComponent(token)}`)

  socket.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data as string)
      for (const handler of handlers) handler(data)
    } catch { /* ignore */ }
  }

  socket.onclose = () => {
    socket = null
    if (active) {
      reconnectTimer = setTimeout(() => {
        const t = localStorage.getItem('mealio_token')
        if (t) connect(t)
      }, 3_000)
    }
  }

  socket.onerror = () => socket?.close()
}

export function startWs(token: string) {
  active = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  connect(token)
}

export function stopWs() {
  active = false
  if (reconnectTimer) clearTimeout(reconnectTimer)
  socket?.close()
  socket = null
}
