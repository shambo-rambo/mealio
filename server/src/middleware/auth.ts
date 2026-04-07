import { createMiddleware } from 'hono/factory'
import { jwtVerify } from 'jose'

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

export const authMiddleware = createMiddleware(async (c, next) => {
  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'unauthorized', message: 'Missing or invalid token' } }, 401)
  }

  const token = authorization.slice(7)
  const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev_secret')

  try {
    const { payload } = await jwtVerify(token, secret)

    c.set('user', {
      userId: payload.sub as string,
      familyId: (payload.familyId as string | null) ?? null,
      role: (payload.role as AuthUser['role']) ?? 'member',
    })

    await next()
  } catch {
    return c.json({ error: { code: 'unauthorized', message: 'Invalid or expired token' } }, 401)
  }
})
