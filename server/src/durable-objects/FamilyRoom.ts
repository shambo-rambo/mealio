// Durable Object — one instance per familyId, handles all WebSocket connections
// for that family and broadcasts events to every connected client.
export class FamilyRoom implements DurableObject {
  private sessions = new Set<WebSocket>()

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // POST /broadcast — called internally by route handlers to fan out an event
    if (url.pathname.endsWith('/broadcast') && request.method === 'POST') {
      const message = await request.text()
      this.broadcast(message)
      return new Response('ok')
    }

    // GET /ws — WebSocket upgrade from the client
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
    this.accept(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  private accept(ws: WebSocket) {
    ws.accept()
    this.sessions.add(ws)

    // Heartbeat ping every 30s to keep the connection alive
    const ping = setInterval(() => {
      if ((ws as unknown as { readyState: number }).readyState === 1 /* OPEN */) {
        ws.send(JSON.stringify({ type: 'ping' }))
      } else {
        this.sessions.delete(ws)
        clearInterval(ping)
      }
    }, 30_000)

    ws.addEventListener('close', () => {
      this.sessions.delete(ws)
      clearInterval(ping)
    })
    ws.addEventListener('error', () => {
      this.sessions.delete(ws)
      clearInterval(ping)
    })
  }

  private broadcast(message: string) {
    const dead = new Set<WebSocket>()
    for (const ws of this.sessions) {
      try {
        ws.send(message)
      } catch {
        dead.add(ws)
      }
    }
    dead.forEach((ws) => this.sessions.delete(ws))
  }
}
