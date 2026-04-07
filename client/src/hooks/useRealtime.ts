import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { startWs, stopWs, onWsMessage } from '../lib/ws'
import { queryKeys } from '../lib/queryKeys'
import type { WsEvent } from '../types'

export function useRealtime(token: string | null) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!token) return

    startWs(token)

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
        case 'recipe:deleted':
          qc.invalidateQueries({ queryKey: queryKeys.recipes.all() })
          if ('recipeId' in event) {
            qc.invalidateQueries({ queryKey: queryKeys.recipes.detail(event.recipeId) })
          }
          break
      }
    })

    return () => {
      unsub()
      stopWs()
    }
  }, [token, qc])
}
