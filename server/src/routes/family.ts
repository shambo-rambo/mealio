import { Hono, type Context } from 'hono'
import { eq, and, gt, isNull, desc, count } from 'drizzle-orm'
import { z } from 'zod'
import { users, families, inviteCodes, familyInvites } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { signToken } from '../lib/jwt.js'
import { publicUser, normalizeEmail, findUserByEmail, randomToken, sha256Hex, rateLimit, clientIp } from '../lib/authHelpers.js'
import { inviteEmail, sendEmail } from '../lib/email.js'
import type { AppDB, AppEnv } from '../types.js'

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

  const baseUrl = c.env?.APP_URL ?? 'http://localhost:5173'
  return c.json({ code, link: `${baseUrl}/join?code=${code}`, expiresAt })
})

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

async function memberCount(db: AppDB, familyId: string) {
  const [row] = await db.select({ n: count() }).from(users).where(eq(users.familyId, familyId))
  return row?.n ?? 0
}

familyRoutes.post('/join', async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const body = await c.req.json().catch(() => null)
  const result = z
    .union([z.object({ code: z.string().length(6) }), z.object({ invite: z.string().min(20) })])
    .safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Valid invite required' } }, 400)

  let targetFamilyId: string
  let emailInviteId: string | null = null
  if ('invite' in result.data) {
    const invite = await db.query.familyInvites.findFirst({
      where: eq(familyInvites.tokenHash, await sha256Hex(result.data.invite)),
    })
    if (!invite || invite.acceptedAt) return c.json({ error: { code: 'invalid_code', message: 'This invitation is no longer valid' } }, 404)
    if (new Date(invite.expiresAt) < new Date()) return c.json({ error: { code: 'expired_code', message: 'This invitation has expired. Ask for a new one.' } }, 410)
    targetFamilyId = invite.familyId
    emailInviteId = invite.id
  } else {
    const invite = await db.query.inviteCodes.findFirst({ where: eq(inviteCodes.code, result.data.code) })
    if (!invite) return c.json({ error: { code: 'invalid_code', message: 'Invalid or expired code' } }, 404)
    if (new Date(invite.expiresAt) < new Date()) return c.json({ error: { code: 'expired_code', message: 'This code has expired' } }, 410)
    targetFamilyId = invite.familyId
  }

  const current = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!current) return c.json({ error: { code: 'server_error', message: 'User not found' } }, 500)
  // Moving out of a family that still has other people in it would strand them (and the data).
  if (current.familyId && current.familyId !== targetFamilyId && (await memberCount(db, current.familyId)) > 1) {
    return c.json({ error: { code: 'already_in_family', message: "You're already in a family with other members, so you can't join another." } }, 409)
  }

  await db.update(users).set({ familyId: targetFamilyId, role: current.familyId === targetFamilyId ? current.role : 'member' }).where(eq(users.id, userId))
  if (emailInviteId) {
    await db.update(familyInvites).set({ acceptedAt: new Date().toISOString(), acceptedBy: userId }).where(eq(familyInvites.id, emailInviteId))
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return c.json({ error: { code: 'server_error', message: 'User not found' } }, 500)

  const family = await db.query.families.findFirst({ where: eq(families.id, targetFamilyId) })
  const token = await signToken({ sub: user.id, familyId: user.familyId, role: user.role as 'owner' | 'admin' | 'member', name: user.name, email: user.email }, c.env?.JWT_SECRET as string | undefined)
  return c.json({ token, user: publicUser(user), family })
})

// ── Email invitations ──────────────────────────────────────────────────────

async function sendInvite(c: Context<AppEnv>, opts: { familyId: string; inviterId: string; email: string }) {
  const db = c.get('db')
  const [family, inviter] = await Promise.all([
    db.query.families.findFirst({ where: eq(families.id, opts.familyId) }),
    db.query.users.findFirst({ where: eq(users.id, opts.inviterId) }),
  ])
  const token = randomToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()
  // One live invite per email per family: re-inviting replaces the old link.
  await db.delete(familyInvites).where(and(eq(familyInvites.familyId, opts.familyId), eq(familyInvites.email, opts.email), isNull(familyInvites.acceptedAt)))
  const id = crypto.randomUUID()
  await db.insert(familyInvites).values({ id, familyId: opts.familyId, email: opts.email, tokenHash: await sha256Hex(token), invitedBy: opts.inviterId, expiresAt })
  const appUrl = (c.env?.APP_URL ?? 'http://localhost:5173').replace(/\/$/, '')
  const link = `${appUrl}/join?invite=${token}`
  const emailSent = await sendEmail(c.env, { to: opts.email, ...inviteEmail(inviter?.name ?? 'Someone', family?.name ?? 'their family', link) })
  return { invite: { id, email: opts.email, expiresAt }, link, emailSent }
}

familyRoutes.get('/invites', async (c) => {
  const db = c.get('db')
  const { familyId, role } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 404)
  if (role === 'member') return c.json({ invites: [] })
  const invites = await db.query.familyInvites.findMany({
    where: and(eq(familyInvites.familyId, familyId), isNull(familyInvites.acceptedAt), gt(familyInvites.expiresAt, new Date().toISOString())),
    orderBy: desc(familyInvites.createdAt),
    columns: { id: true, email: true, expiresAt: true, createdAt: true },
  })
  return c.json({ invites })
})

familyRoutes.post('/invites', async (c) => {
  const db = c.get('db')
  const { familyId, role, userId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 404)
  if (role === 'member') return c.json({ error: { code: 'forbidden', message: 'Admins only' } }, 403)

  const result = z.object({ email: z.string().trim().email('Enter a valid email address') }).safeParse(await c.req.json().catch(() => null))
  if (!result.success) return c.json({ error: { code: 'validation_error', message: result.error.issues[0].message } }, 400)
  const email = normalizeEmail(result.data.email)

  if (!(await rateLimit(db, `invite:${familyId}`, 20, 86400))) {
    return c.json({ error: { code: 'rate_limited', message: 'Invite limit reached for today. Try again tomorrow.' } }, 429)
  }

  const existing = await findUserByEmail(db, email)
  if (existing?.familyId === familyId) {
    return c.json({ error: { code: 'already_member', message: 'That person is already in your family.' } }, 409)
  }

  return c.json(await sendInvite(c, { familyId, inviterId: userId, email }), 201)
})

familyRoutes.post('/invites/:id/resend', async (c) => {
  const db = c.get('db')
  const { familyId, role, userId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 404)
  if (role === 'member') return c.json({ error: { code: 'forbidden', message: 'Admins only' } }, 403)
  const invite = await db.query.familyInvites.findFirst({ where: and(eq(familyInvites.id, c.req.param('id')), eq(familyInvites.familyId, familyId), isNull(familyInvites.acceptedAt)) })
  if (!invite) return c.json({ error: { code: 'not_found', message: 'Invite not found' } }, 404)
  if (!(await rateLimit(db, `invite:${familyId}`, 20, 86400))) {
    return c.json({ error: { code: 'rate_limited', message: 'Invite limit reached for today. Try again tomorrow.' } }, 429)
  }
  return c.json(await sendInvite(c, { familyId, inviterId: userId, email: invite.email }))
})

familyRoutes.delete('/invites/:id', async (c) => {
  const db = c.get('db')
  const { familyId, role } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 404)
  if (role === 'member') return c.json({ error: { code: 'forbidden', message: 'Admins only' } }, 403)
  await db.delete(familyInvites).where(and(eq(familyInvites.id, c.req.param('id')), eq(familyInvites.familyId, familyId)))
  return c.json({ ok: true })
})

// Public: lets the join page say who invited you before you've signed in.
export const publicInviteRoutes = new Hono<AppEnv>()
publicInviteRoutes.get('/:token', async (c) => {
  const db = c.get('db')
  if (!(await rateLimit(db, `invite-preview:${clientIp((n) => c.req.header(n))}`, 60, 900))) {
    return c.json({ error: { code: 'rate_limited', message: 'Too many requests' } }, 429)
  }
  const invite = await db.query.familyInvites.findFirst({ where: eq(familyInvites.tokenHash, await sha256Hex(c.req.param('token'))) })
  if (!invite || invite.acceptedAt || new Date(invite.expiresAt) < new Date()) {
    return c.json({ error: { code: 'invalid_code', message: 'This invitation is no longer valid' } }, 404)
  }
  const [family, inviter] = await Promise.all([
    db.query.families.findFirst({ where: eq(families.id, invite.familyId) }),
    invite.invitedBy ? db.query.users.findFirst({ where: eq(users.id, invite.invitedBy) }) : null,
  ])
  return c.json({ familyName: family?.name ?? 'a family', inviterName: inviter?.name ?? null, email: invite.email })
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
