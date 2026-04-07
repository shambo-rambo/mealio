import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { pushSubscriptions } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { getVapidPublicKey } from '../lib/push.js'
import type { AppEnv } from '../types.js'

export const pushRoutes = new Hono<AppEnv>()
pushRoutes.use('*', authMiddleware)

pushRoutes.get('/vapid-key', (c) => {
  const key = getVapidPublicKey()
  if (!key) return c.json({ error: { code: 'not_configured', message: 'Push not configured' } }, 503)
  return c.json({ vapidPublicKey: key })
})

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
})

pushRoutes.post('/subscribe', async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const body = await c.req.json().catch(() => null)
  const result = subscribeSchema.safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Invalid subscription' } }, 400)

  const { endpoint, keys } = result.data
  const existing = await db.query.pushSubscriptions.findFirst({ where: eq(pushSubscriptions.endpoint, endpoint) })
  if (!existing) {
    await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
  }
  return c.json({ ok: true })
})

pushRoutes.post('/unsubscribe', async (c) => {
  const db = c.get('db')
  const body = await c.req.json().catch(() => null)
  const result = z.object({ endpoint: z.string() }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'endpoint required' } }, 400)

  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, result.data.endpoint))
  return c.json({ ok: true })
})
