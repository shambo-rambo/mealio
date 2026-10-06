import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { users, families, inviteCodes } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { signToken } from '../lib/jwt.js'
import { publicUser } from '../lib/authHelpers.js'
import type { AppEnv } from '../types.js'

export const familyRoutes = new Hono<AppEnv>()
familyRoutes.use('*', authMiddleware)

familyRoutes.get('/', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 404)

  const family = await db.query.families.findFirst({ where: eq(families.id, familyId) })
  if (!family) return c.json({ error: { code: 'not_found', message: 'Family not found' } }, 404)

  const members = await db.query.users.findMany({
    where: eq(users.familyId, familyId),
    columns: { passwordHash: false, googleId: false },
  })
  return c.json({ family, members })
})

familyRoutes.post('/', async (c) => {
  const db = c.get('db')
  const { userId, familyId: existingFamilyId } = c.get('user')
  if (existingFamilyId) return c.json({ error: { code: 'already_in_family', message: 'Already in a family' } }, 409)

  const body = await c.req.json().catch(() => null)
  const result = z.object({ name: z.string().min(1).max(100) }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Family name required' } }, 400)

  const familyId = crypto.randomUUID()
  await db.insert(families).values({ id: familyId, name: result.data.name, ownerId: userId })
  await db.update(users).set({ familyId, role: 'owner' }).where(eq(users.id, userId))

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return c.json({ error: { code: 'server_error', message: 'User not found' } }, 500)

  const token = await signToken({ sub: user.id, familyId, role: 'owner', name: user.name, email: user.email }, c.env?.JWT_SECRET as string | undefined)
  return c.json({ token, user: publicUser(user) }, 201)
})

familyRoutes.patch('/', async (c) => {
  const db = c.get('db')
  const { familyId, role } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 404)
  if (role === 'member') return c.json({ error: { code: 'forbidden', message: 'Admins only' } }, 403)

  const body = await c.req.json().catch(() => null)
  const result = z.object({ name: z.string().min(1).max(100) }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Name required' } }, 400)

  const [updated] = await db.update(families).set({ name: result.data.name }).where(eq(families.id, familyId)).returning()
  return c.json({ family: updated })
})

familyRoutes.post('/invite', async (c) => {
  const db = c.get('db')
  const { familyId, role, userId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 404)
  if (role === 'member') return c.json({ error: { code: 'forbidden', message: 'Admins only' } }, 403)

  await db.delete(inviteCodes).where(eq(inviteCodes.familyId, familyId))

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await db.insert(inviteCodes).values({ familyId, code, expiresAt, createdBy: userId })

  const baseUrl = process.env.APP_URL ?? 'http://localhost:5173'
  return c.json({ code, link: `${baseUrl}/join?code=${code}`, expiresAt })
})

familyRoutes.post('/join', async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const body = await c.req.json().catch(() => null)
  const result = z.object({ code: z.string().length(6) }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Valid 6-digit code required' } }, 400)

  const invite = await db.query.inviteCodes.findFirst({ where: eq(inviteCodes.code, result.data.code) })
  if (!invite) return c.json({ error: { code: 'invalid_code', message: 'Invalid or expired code' } }, 404)
  if (new Date(invite.expiresAt) < new Date()) return c.json({ error: { code: 'expired_code', message: 'This code has expired' } }, 410)

  await db.update(users).set({ familyId: invite.familyId, role: 'member' }).where(eq(users.id, userId))

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return c.json({ error: { code: 'server_error', message: 'User not found' } }, 500)

  const family = await db.query.families.findFirst({ where: eq(families.id, invite.familyId) })
  const token = await signToken({ sub: user.id, familyId: user.familyId, role: user.role as 'owner' | 'admin' | 'member', name: user.name, email: user.email }, c.env?.JWT_SECRET as string | undefined)
  return c.json({ token, user: publicUser(user), family })
})

familyRoutes.delete('/members/:memberId', async (c) => {
  const db = c.get('db')
  const { familyId, userId, role } = c.get('user')
  const memberId = c.req.param('memberId')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 404)
  if (role === 'member') return c.json({ error: { code: 'forbidden', message: 'Admins only' } }, 403)
  if (memberId === userId) return c.json({ error: { code: 'forbidden', message: 'Cannot remove yourself' } }, 403)

  const target = await db.query.users.findFirst({ where: eq(users.id, memberId) })
  if (!target || target.familyId !== familyId) return c.json({ error: { code: 'not_found', message: 'Member not found' } }, 404)

  const family = await db.query.families.findFirst({ where: eq(families.id, familyId) })
  if (family?.ownerId === memberId) return c.json({ error: { code: 'forbidden', message: 'Cannot remove the family owner' } }, 403)

  await db.update(users).set({ familyId: null, role: 'owner' }).where(eq(users.id, memberId))
  return c.json({ ok: true })
})

familyRoutes.patch('/members/:memberId', async (c) => {
  const db = c.get('db')
  const { familyId, userId, role } = c.get('user')
  const memberId = c.req.param('memberId')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 404)
  if (role !== 'owner') return c.json({ error: { code: 'forbidden', message: 'Owner only' } }, 403)

  const body = await c.req.json().catch(() => null)
  const result = z.object({ role: z.enum(['admin', 'member']) }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Invalid role' } }, 400)

  await db.update(users).set({ role: result.data.role }).where(and(eq(users.id, memberId), eq(users.familyId, familyId)))
  return c.json({ ok: true })
})
