import webpush from 'web-push'
import { eq } from 'drizzle-orm'
import { pushSubscriptions, users } from '../db/schema.js'
import type { AppDB } from '../db/index.js'

export type PushPayload = {
  title: string
  body: string
  tag?: string
  url?: string
}

function initVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY ?? ''
  const priv = process.env.VAPID_PRIVATE_KEY ?? ''
  if (pub && priv) {
    webpush.setVapidDetails('mailto:app@mealio.local', pub, priv)
    return true
  }
  return false
}

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? ''
}

export async function pushToFamily(
  db: AppDB,
  familyId: string,
  payload: PushPayload,
  excludeUserId?: string,
): Promise<void> {
  if (!initVapid()) return

  const familyUsers = await db.query.users.findMany({ where: eq(users.familyId, familyId) })
  const targetIds = familyUsers.map((u) => u.id).filter((id) => id !== excludeUserId)

  const subs = (
    await Promise.all(
      targetIds.map((uid) =>
        db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, uid) })
      )
    )
  ).flat()

  const data = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data,
        )
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id))
        }
      }
    })
  )
}
