import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { getDb } from './db/index.js'
import { authRoutes } from './routes/auth.js'
import { familyRoutes } from './routes/family.js'
import { listsRoutes, publicListsRoutes } from './routes/lists.js'
import { storesRoutes } from './routes/stores.js'
import { recipesRoutes, publicRecipesRoutes } from './routes/recipes.js'
import { collectionsRoutes } from './routes/collections.js'
import { mealPlanRoutes } from './routes/mealPlan.js'
import { uploadRoutes } from './routes/upload.js'
import { pushRoutes } from './routes/push.js'
import { verifyToken } from './lib/jwt.js'
import type { AppEnv } from './types.js'

export { FamilyRoom } from './durable-objects/FamilyRoom.js'

const app = new Hono<AppEnv>()

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use('*', secureHeaders())
app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
    credentials: true,
  }),
)

// Attach D1 db instance to every request context
app.use('*', (c, next) => {
  c.set('db', getDb(c.env.DB))
  return next()
})

// ---------------------------------------------------------------------------
// R2 file serving — /uploads/:filename
// ---------------------------------------------------------------------------
app.get('/uploads/:filename', async (c) => {
  const filename = c.req.param('filename')
  const object = await c.env.R2.get(filename)
  if (!object) return c.json({ error: 'Not found' }, 404)
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(object.body, { headers })
})

// ---------------------------------------------------------------------------
// WebSocket upgrade — authenticates JWT then hands off to FamilyRoom DO
// ---------------------------------------------------------------------------
app.get('/ws', async (c) => {
  // Reject non-WebSocket requests before doing any auth work
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426)
  }

  // Helper: accept the WS upgrade then immediately close with an app-defined
  // error code (RFC 6455 §7.4.2 — codes 4000-4999 are application-reserved).
  // This lets the client read event.code in onclose rather than getting a
  // featureless onerror with no status information.
  const wsReject = (code: number, reason: string): Response => {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
    server.accept()
    server.close(code, reason)
    return new Response(null, { status: 101, webSocket: client })
  }

  const token = c.req.query('token')
  if (!token) return wsReject(4401, 'Missing token')

  let familyId: string | null = null
  try {
    const payload = await verifyToken(token, c.env?.JWT_SECRET as string | undefined)
    familyId = payload.familyId ?? null
  } catch {
    return wsReject(4401, 'Invalid or expired token')
  }

  if (!familyId) return wsReject(4403, 'No family associated with this account')

  const id = c.env.FAMILY_ROOM.idFromName(familyId)
  const room = c.env.FAMILY_ROOM.get(id)
  return room.fetch(new Request('https://do/ws', { headers: c.req.raw.headers }))
})

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (c) => c.json({ ok: true, timestamp: new Date().toISOString() }))
app.get('/api/v1/health', (c) => c.json({ ok: true, timestamp: new Date().toISOString() }))

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.route('/api/v1/auth', authRoutes)
app.route('/api/v1/family', familyRoutes)
app.route('/api/v1/lists', listsRoutes)
app.route('/api/v1/stores', storesRoutes)
app.route('/api/v1/recipes', recipesRoutes)
app.route('/api/v1/collections', collectionsRoutes)
app.route('/api/v1/meal-plan', mealPlanRoutes)
app.route('/api/v1/upload', uploadRoutes)
app.route('/api/v1/push', pushRoutes)
app.route('/api/v1/public/lists', publicListsRoutes)
app.route('/api/v1/public/recipes', publicRecipesRoutes)

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
app.onError((err, c) => {
  console.error(err)
  const status = 'status' in err && typeof err.status === 'number' ? err.status : 500
  return c.json(
    { error: { code: 'internal_error', message: err.message || 'Internal server error' } },
    status as Parameters<typeof c.json>[1],
  )
})

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Route not found' } }, 404))

export default app
