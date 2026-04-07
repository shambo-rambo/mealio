import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { stores } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

export const storesRoutes = new Hono<AppEnv>()
storesRoutes.use('*', authMiddleware)

storesRoutes.get('/', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  if (!familyId) return c.json({ stores: [] })
  const list = await db.query.stores.findMany({ where: eq(stores.familyId, familyId) })
  return c.json({ stores: list })
})

storesRoutes.post('/', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 400)

  const body = await c.req.json().catch(() => null)
  const result = z.object({ name: z.string().min(1).max(100) }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Name required' } }, 400)

  const [store] = await db.insert(stores).values({ name: result.data.name, familyId }).returning()
  return c.json({ store }, 201)
})

storesRoutes.delete('/:id', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const id = c.req.param('id')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 400)
  await db.delete(stores).where(and(eq(stores.id, id), eq(stores.familyId, familyId)))
  return c.json({ ok: true })
})
