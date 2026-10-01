import { SignJWT, jwtVerify } from 'jose'

const DEV_SECRET = 'dev_secret_change_in_production'

function getSecret(secret?: string) {
  return new TextEncoder().encode(secret ?? process.env.JWT_SECRET ?? DEV_SECRET)
}

export interface JWTPayload {
  sub: string // userId
  familyId: string | null
  role: 'owner' | 'admin' | 'member'
  name: string
  email: string
}

export async function signToken(payload: JWTPayload, secret?: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret(secret))
}

export async function verifyToken(token: string, secret?: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getSecret(secret))
  return payload as unknown as JWTPayload
}
