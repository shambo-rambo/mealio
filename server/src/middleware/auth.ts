import { createMiddleware } from 'hono/factory'
import { verifyToken } from '../lib/jwt.js'
import type { AppEnv } from '../types.js'

export type AuthUser = {
  userId: string
  familyId: string | null
  role: 'owner' | 'admin' | 'member'
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'unauthorized', message: 'Missing or invalid token' } }, 401)
  }

  const token = authorization.slice(7)
  const secret = c.env?.JWT_SECRET as string | undefined

  try {
    const payload = await verifyToken(token, secret)

    c.set('user', {
      userId: payload.sub,
      familyId: payload.familyId ?? null,
      role: payload.role ?? 'member',
    })

    await next()
  } catch {
    return c.json({ error: { code: 'unauthorized', message: 'Invalid or expired token' } }, 401)
  }
})
