import { useEffect } from 'react'
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

  useEffect(() => {
    if (!token) return

    startWs(token)

    // ws:auth-failed is dispatched by ws.ts when the server closes the socket
    // with a 4401/4403 code — meaning the stored token is invalid or expired.
    const onAuthFailed = () => {
      clearAuth()
      navigate('/login', { replace: true })
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
  }, [token, qc, clearAuth, navigate])
}
