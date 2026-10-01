import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../db/schema.js'
import { signToken } from '../lib/jwt.js'
import { authMiddleware } from '../middleware/auth.js'
import { registerSchema, loginSchema } from '../schemas/auth.js'
import type { AppEnv } from '../types.js'

export const authRoutes = new Hono<AppEnv>()

authRoutes.post('/register', async (c) => {
  const db = c.get('db')
  const body = await c.req.json().catch(() => null)
  const result = registerSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: { code: 'validation_error', message: result.error.issues[0].message } }, 400)
  }
  const { name, email, password } = result.data

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) {
    return c.json({ error: { code: 'email_taken', message: 'An account with that email already exists' } }, 409)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const userId = crypto.randomUUID()

  await db.insert(users).values({ id: userId, name, email, passwordHash, familyId: null, role: 'owner' })

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return c.json({ error: { code: 'server_error', message: 'Failed to create user' } }, 500)

  const jwtSecret = c.env?.JWT_SECRET as string | undefined
  const token = await signToken({ sub: user.id, familyId: null, role: user.role as 'owner', name: user.name, email: user.email }, jwtSecret)
  const { passwordHash: _, ...safeUser } = user
  return c.json({ token, user: safeUser }, 201)
})

authRoutes.post('/login', async (c) => {
  const db = c.get('db')
  const body = await c.req.json().catch(() => null)
  const result = loginSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: { code: 'validation_error', message: result.error.issues[0].message } }, 400)
  }
  const { email, password } = result.data

  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!user) return c.json({ error: { code: 'invalid_credentials', message: 'Invalid email or password' } }, 401)

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return c.json({ error: { code: 'invalid_credentials', message: 'Invalid email or password' } }, 401)

  const jwtSecret = c.env?.JWT_SECRET as string | undefined
  const token = await signToken({ sub: user.id, familyId: user.familyId, role: user.role as 'owner' | 'admin' | 'member', name: user.name, email: user.email }, jwtSecret)
  const { passwordHash: _, ...safeUser } = user
  return c.json({ token, user: safeUser })
})

authRoutes.post('/logout', (c) => c.json({ ok: true }))

authRoutes.patch('/profile', authMiddleware, async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const body = await c.req.json().catch(() => null)
  const result = z.object({ name: z.string().min(1).optional() }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Invalid data' } }, 400)

  await db.update(users).set(result.data).where(eq(users.id, userId))
  const updated = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!updated) return c.json({ error: { code: 'not_found', message: 'User not found' } }, 404)
  const { passwordHash: _, ...safeUser } = updated
  return c.json({ user: safeUser })
})

authRoutes.post('/change-password', authMiddleware, async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const body = await c.req.json().catch(() => null)
  const result = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Invalid data' } }, 400)

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return c.json({ error: { code: 'not_found', message: 'User not found' } }, 404)

  const valid = await bcrypt.compare(result.data.currentPassword, user.passwordHash)
  if (!valid) return c.json({ error: { code: 'invalid_credentials', message: 'Current password is incorrect' } }, 401)

  const passwordHash = await bcrypt.hash(result.data.newPassword, 12)
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
  return c.json({ ok: true })
})
