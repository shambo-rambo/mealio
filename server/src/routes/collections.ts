import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { collections } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

export const collectionsRoutes = new Hono<AppEnv>()
collectionsRoutes.use('*', authMiddleware)

collectionsRoutes.get('/', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  if (!familyId) return c.json({ collections: [] })
  const list = await db.query.collections.findMany({ where: eq(collections.familyId, familyId) })
  return c.json({ collections: list })
})

collectionsRoutes.post('/', async (c) => {
  const db = c.get('db')
  const { familyId, userId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 400)

  const body = await c.req.json().catch(() => null)
  const result = z.object({ name: z.string().min(1).max(100) }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Name required' } }, 400)

  const [col] = await db.insert(collections).values({ name: result.data.name, familyId, createdBy: userId }).returning()
  return c.json({ collection: col }, 201)
})

collectionsRoutes.delete('/:id', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const id = c.req.param('id')
  await db.delete(collections).where(and(eq(collections.id, id), eq(collections.familyId, familyId!)))
  return c.json({ ok: true })
})
