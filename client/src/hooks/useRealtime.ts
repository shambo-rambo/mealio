import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { startWs, stopWs, onWsMessage } from '../lib/ws'
import { useAuthStore } from '../store/authStore'
import { queryKeys } from '../lib/queryKeys'
import type { WsEvent } from '../types'

export function useRealtime(token: string | null) {
  const qc = useQueryClient()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()
  const hasFamily = useAuthStore((s) => !!s.user?.familyId)
  // useNavigate's identity changes on every route change; keep it out of the effect deps
  // so navigating doesn't tear down and reconnect the socket.
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    // Accounts without a family have no room to join yet (the server closes with 4403).
    if (!token || !hasFamily) return

    startWs(token)

    // ws:auth-failed is dispatched by ws.ts when the server closes the socket
    // with a 4401/4403 code — meaning the stored token is invalid or expired.
    const onAuthFailed = (e: Event) => {
      // 4403 just means "no family yet" - not a reason to sign the user out.
      if ((e as CustomEvent).detail?.code !== 4401) return
      clearAuth()
      navigateRef.current('/login', { replace: true })
    }
    window.addEventListener('ws:auth-failed', onAuthFailed)

    const unsub = onWsMessage((raw) => {
      const event = raw as WsEvent
      switch (event.type) {
        case 'list:created':
        case 'list:deleted':
          qc.invalidateQueries({ queryKey: queryKeys.lists.all() })
          break
        case 'list:updated':
          qc.invalidateQueries({ queryKey: queryKeys.lists.all() })
          break
        case 'list:item:added':
        case 'list:item:updated':
        case 'list:item:deleted':
          qc.invalidateQueries({ queryKey: queryKeys.lists.items(event.listId) })
          qc.invalidateQueries({ queryKey: queryKeys.lists.all() })
          break
        case 'meal-plan:updated':
          qc.invalidateQueries({ queryKey: ['meal-plan'] })
          break
        case 'recipe:created':
        case 'recipe:updated':
          qc.invalidateQueries({ queryKey: queryKeys.recipes.lists() })
          if ('recipeId' in event) {
            qc.invalidateQueries({ queryKey: queryKeys.recipes.detail(event.recipeId) })
          }
          break
        case 'recipe:deleted':
          qc.invalidateQueries({ queryKey: queryKeys.recipes.lists() })
          break
      }
    })

    return () => {
      window.removeEventListener('ws:auth-failed', onAuthFailed)
      unsub()
      stopWs()
    }
  }, [token, hasFamily, qc, clearAuth])
}
