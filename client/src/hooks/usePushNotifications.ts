import { useState, useEffect } from 'react'
import { api } from '../lib/api'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray.buffer
}

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>(() => {
    if (!('Notification' in window)) return 'unsupported'
    return Notification.permission as PushPermission
  })
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported')
    } else {
      setPermission(Notification.permission as PushPermission)
    }
  }, [])

  const subscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    setSubscribing(true)
    try {
      // Get VAPID public key
      const { data } = await api.get<{ vapidPublicKey: string }>('/push/vapid-key')
      const applicationServerKey = urlBase64ToUint8Array(data.vapidPublicKey)

      // Request permission
      const perm = await Notification.requestPermission()
      setPermission(perm as PushPermission)
      if (perm !== 'granted') return

      // Subscribe via service worker
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      const json = sub.toJSON()
      await api.post('/push/subscribe', {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      })
    } catch (err) {
      console.error('Push subscribe failed', err)
    } finally {
      setSubscribing(false)
    }
  }

  const unsubscribe = async () => {
    if (!('serviceWorker' in navigator)) return
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.getSubscription()
    if (!sub) return
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint })
    await sub.unsubscribe()
    setPermission('default')
  }

  return { permission, subscribing, subscribe, unsubscribe }
}
