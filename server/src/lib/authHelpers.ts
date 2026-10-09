import { createRemoteJWKSet, jwtVerify } from 'jose'
import { eq, sql } from 'drizzle-orm'
import { authAttempts, users } from '../db/schema.js'
import { signToken } from './jwt.js'
import type { AppDB, Bindings } from '../types.js'

type UserRow = typeof users.$inferSelect

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export function findUserByEmail(db: AppDB, email: string) {
  return db.query.users.findFirst({ where: sql`lower(${users.email}) = ${normalizeEmail(email)}` })
}

/** User object that is safe to send to the client (no hash, no Google subject id). */
export function publicUser(user: UserRow) {
  const { passwordHash, googleId, ...rest } = user
  return { ...rest, hasPassword: passwordHash !== '', googleLinked: googleId !== null }
}

export async function issueSession(user: UserRow, env?: Bindings) {
  const token = await signToken(
    { sub: user.id, familyId: user.familyId, role: user.role, name: user.name, email: user.email },
    env?.JWT_SECRET,
  )
  return { token, user: publicUser(user) }
}

export function clientIp(headers: { get(name: string): string | null | undefined } | ((n: string) => string | undefined)): string {
  const get = typeof headers === 'function' ? headers : (n: string) => headers.get(n) ?? undefined
  return get('CF-Connecting-IP') ?? get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'
}

/**
 * Fixed-window rate limit backed by D1. Returns true if the call is allowed.
 * Counts every call; callers decide what to key on.
 */
export async function rateLimit(db: AppDB, key: string, max: number, windowSec: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000)
  const row = await db.query.authAttempts.findFirst({ where: eq(authAttempts.key, key) })
  if (!row || now - row.windowStart >= windowSec) {
    await db
      .insert(authAttempts)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({ target: authAttempts.key, set: { count: 1, windowStart: now } })
    return true
  }
  if (row.count >= max) return false
  await db.update(authAttempts).set({ count: row.count + 1 }).where(eq(authAttempts.key, key))
  return true
}

export async function clearRateLimit(db: AppDB, key: string) {
  await db.delete(authAttempts).where(eq(authAttempts.key, key))
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomToken(bytes = 32): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export interface GoogleProfile {
  sub: string
  email: string
  name: string
  picture: string | null
}

export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
  })
  if (!payload.email || payload.email_verified !== true) throw new Error('Google email not verified')
  const email = String(payload.email)
  return {
    sub: String(payload.sub),
    email,
    name: typeof payload.name === 'string' && payload.name ? payload.name : email.split('@')[0],
    picture: typeof payload.picture === 'string' ? payload.picture : null,
  }
}
