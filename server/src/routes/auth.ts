import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { passwordResets, users } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
  googleSchema,
  changePasswordSchema,
} from '../schemas/auth.js'
import {
  clearRateLimit,
  clientIp,
  findUserByEmail,
  issueSession,
  normalizeEmail,
  publicUser,
  randomToken,
  rateLimit,
  sha256Hex,
  verifyGoogleIdToken,
} from '../lib/authHelpers.js'
import { resetEmail, sendEmail } from '../lib/email.js'
import type { AppEnv } from '../types.js'

export const authRoutes = new Hono<AppEnv>()

const err = (code: string, message: string) => ({ error: { code, message } })
const tooMany = err('rate_limited', 'Too many attempts. Please wait a few minutes and try again.')

// Valid bcrypt hash of a random string: compared against when the account doesn't exist,
// so response time doesn't reveal whether an email is registered.
const DUMMY_HASH = '$2a$12$witeNC6VUglft2dNuJSHl.SyRWLeRvXoOmLbkE/psJ0Pl6lgW0d4O'

const RESET_TTL_MS = 60 * 60 * 1000

authRoutes.post('/register', async (c) => {
  const db = c.get('db')
  const ip = clientIp((n) => c.req.header(n))
  if (!(await rateLimit(db, `register:${ip}`, 10, 3600))) return c.json(tooMany, 429)

  const result = registerSchema.safeParse(await c.req.json().catch(() => null))
  if (!result.success) return c.json(err('validation_error', result.error.issues[0].message), 400)
  const { name, password } = result.data
  const email = normalizeEmail(result.data.email)

  const existing = await findUserByEmail(db, email)
  if (existing) {
    const message = existing.googleId && !existing.passwordHash
      ? 'That email is already registered with Google. Use "Continue with Google" to sign in.'
      : 'An account with that email already exists. Try signing in instead.'
    return c.json(err('email_taken', message), 409)
  }

  const userId = crypto.randomUUID()
  await db.insert(users).values({
    id: userId,
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    familyId: null,
    role: 'owner',
  })
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return c.json(err('server_error', 'Failed to create user'), 500)
  return c.json(await issueSession(user, c.env), 201)
})

authRoutes.post('/login', async (c) => {
  const db = c.get('db')
  const result = loginSchema.safeParse(await c.req.json().catch(() => null))
  if (!result.success) return c.json(err('validation_error', result.error.issues[0].message), 400)
  const { password } = result.data
  const email = normalizeEmail(result.data.email)

  const ip = clientIp((n) => c.req.header(n))
  const keys = [`login:${ip}:${email}`, `login-ip:${ip}`]
  if (!(await rateLimit(db, keys[0], 8, 900)) || !(await rateLimit(db, keys[1], 40, 900))) return c.json(tooMany, 429)

  const user = await findUserByEmail(db, email)
  const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH)
  if (!user || !user.passwordHash || !valid) {
    if (user && !user.passwordHash) {
      return c.json(err('use_google', 'This account uses Google sign-in. Use "Continue with Google", or reset your password to add one.'), 401)
    }
    return c.json(err('invalid_credentials', 'Incorrect email or password'), 401)
  }

  await clearRateLimit(db, keys[0])
  return c.json(await issueSession(user, c.env))
})

authRoutes.post('/google', async (c) => {
  const db = c.get('db')
  const clientId = c.env?.GOOGLE_CLIENT_ID
  if (!clientId) return c.json(err('not_configured', 'Google sign-in is not set up yet'), 501)

  const ip = clientIp((n) => c.req.header(n))
  if (!(await rateLimit(db, `google:${ip}`, 30, 900))) return c.json(tooMany, 429)

  const parsed = googleSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json(err('validation_error', 'Missing Google credential'), 400)

  let profile
  try {
    profile = await verifyGoogleIdToken(parsed.data.credential, clientId)
  } catch {
    return c.json(err('invalid_google_token', 'Google sign-in failed. Please try again.'), 401)
  }

  let user = await db.query.users.findFirst({ where: eq(users.googleId, profile.sub) })
  let isNew = false

  if (!user) {
    const byEmail = await findUserByEmail(db, profile.email)
    if (byEmail) {
      // Google vouches for this email, so link. If the existing account never verified its
      // email, someone may have pre-registered it with a password they know: drop that password.
      await db
        .update(users)
        .set({
          googleId: profile.sub,
          emailVerified: true,
          avatar: byEmail.avatar ?? profile.picture,
          ...(byEmail.emailVerified ? {} : { passwordHash: '' }),
        })
        .where(eq(users.id, byEmail.id))
      user = await db.query.users.findFirst({ where: eq(users.id, byEmail.id) })
    } else {
      const id = crypto.randomUUID()
      await db.insert(users).values({
        id,
        name: profile.name,
        email: normalizeEmail(profile.email),
        passwordHash: '',
        googleId: profile.sub,
        emailVerified: true,
        avatar: profile.picture,
        familyId: null,
        role: 'owner',
      })
      user = await db.query.users.findFirst({ where: eq(users.id, id) })
      isNew = true
    }
  }
  if (!user) return c.json(err('server_error', 'Failed to sign in'), 500)
  return c.json({ ...(await issueSession(user, c.env)), isNew })
})

// Attach a Google account to the signed-in user, even if its email differs from the account's.
authRoutes.post('/google/link', authMiddleware, async (c) => {
  const db = c.get('db')
  const clientId = c.env?.GOOGLE_CLIENT_ID
  if (!clientId) return c.json(err('not_configured', 'Google sign-in is not set up yet'), 501)
  const { userId } = c.get('user')

  const parsed = googleSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json(err('validation_error', 'Missing Google credential'), 400)

  let profile
  try {
    profile = await verifyGoogleIdToken(parsed.data.credential, clientId)
  } catch {
    return c.json(err('invalid_google_token', 'Google sign-in failed. Please try again.'), 401)
  }

  const owner = await db.query.users.findFirst({ where: eq(users.googleId, profile.sub) })
  if (owner && owner.id !== userId) {
    // An empty, Google-only account with no family is the leftover of signing in with Google
    // before connecting it. The caller just proved they own this Google identity, so drop it.
    if (!owner.familyId && !owner.passwordHash) {
      await db.delete(users).where(eq(users.id, owner.id))
    } else {
      return c.json(err('google_in_use', 'That Google account is already connected to a different Food Prep account.'), 409)
    }
  }
  await db.update(users).set({ googleId: profile.sub }).where(eq(users.id, userId))
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return c.json(err('not_found', 'User not found'), 404)
  return c.json(await issueSession(user, c.env))
})

authRoutes.post('/forgot-password', async (c) => {
  const db = c.get('db')
  const parsed = forgotSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json(err('validation_error', parsed.error.issues[0].message), 400)
  const email = normalizeEmail(parsed.data.email)

  // Same response whether or not the account exists, so this can't be used to probe for emails.
  const ok = c.json({ ok: true })
  const ip = clientIp((n) => c.req.header(n))
  if (!(await rateLimit(db, `forgot:${email}`, 3, 3600)) || !(await rateLimit(db, `forgot-ip:${ip}`, 20, 3600))) return ok

  const user = await findUserByEmail(db, email)
  if (!user) return ok

  const token = randomToken()
  await db.delete(passwordResets).where(eq(passwordResets.userId, user.id))
  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash: await sha256Hex(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString(),
  })

  const appUrl = (c.env?.APP_URL ?? 'http://localhost:5173').replace(/\/$/, '')
  await sendEmail(c.env, { to: user.email, ...resetEmail(user.name, `${appUrl}/reset-password?token=${token}`) })
  return ok
})

authRoutes.post('/reset-password', async (c) => {
  const db = c.get('db')
  const ip = clientIp((n) => c.req.header(n))
  if (!(await rateLimit(db, `reset-ip:${ip}`, 20, 3600))) return c.json(tooMany, 429)

  const parsed = resetSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json(err('validation_error', parsed.error.issues[0].message), 400)

  const tokenHash = await sha256Hex(parsed.data.token)
  const row = await db.query.passwordResets.findFirst({
    where: and(
      eq(passwordResets.tokenHash, tokenHash),
      isNull(passwordResets.usedAt),
      gt(passwordResets.expiresAt, new Date().toISOString()),
    ),
  })
  if (!row) return c.json(err('invalid_token', 'This reset link is invalid or has expired. Request a new one.'), 400)

  await db.update(passwordResets).set({ usedAt: new Date().toISOString() }).where(eq(passwordResets.id, row.id))
  // Following the emailed link proves control of the inbox.
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(parsed.data.password, 12), emailVerified: true })
    .where(eq(users.id, row.userId))

  const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) })
  if (!user) return c.json(err('not_found', 'User not found'), 404)
  return c.json(await issueSession(user, c.env))
})

authRoutes.post('/logout', (c) => c.json({ ok: true }))

authRoutes.get('/me', authMiddleware, async (c) => {
  const db = c.get('db')
  const user = await db.query.users.findFirst({ where: eq(users.id, c.get('user').userId) })
  if (!user) return c.json(err('unauthorized', 'Account no longer exists'), 401)
  return c.json({ user: publicUser(user) })
})

authRoutes.patch('/profile', authMiddleware, async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const result = z.object({ name: z.string().trim().min(1).max(100).optional() }).safeParse(await c.req.json().catch(() => null))
  if (!result.success) return c.json(err('validation_error', 'Invalid data'), 400)

  await db.update(users).set(result.data).where(eq(users.id, userId))
  const updated = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!updated) return c.json(err('not_found', 'User not found'), 404)
  return c.json({ user: publicUser(updated) })
})

authRoutes.post('/change-password', authMiddleware, async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const result = changePasswordSchema.safeParse(await c.req.json().catch(() => null))
  if (!result.success) return c.json(err('validation_error', result.error.issues[0].message), 400)

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return c.json(err('not_found', 'User not found'), 404)

  // Google-only accounts have no password yet, so they can set one without a current password.
  if (user.passwordHash) {
    if (!(await rateLimit(db, `chpw:${userId}`, 8, 900))) return c.json(tooMany, 429)
    const valid = await bcrypt.compare(result.data.currentPassword ?? '', user.passwordHash)
    if (!valid) return c.json(err('invalid_credentials', 'Current password is incorrect'), 401)
  }

  await db.update(users).set({ passwordHash: await bcrypt.hash(result.data.newPassword, 12) }).where(eq(users.id, userId))
  return c.json({ ok: true })
})
