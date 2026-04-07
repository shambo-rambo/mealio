export type WsEvent =
  | { type: 'list:created' | 'list:updated' | 'list:deleted'; listId: string }
  | { type: 'list:item:added' | 'list:item:updated' | 'list:item:deleted'; listId: string; itemId: string }
  | { type: 'meal-plan:updated'; familyId: string }
  | { type: 'recipe:created' | 'recipe:updated' | 'recipe:deleted'; recipeId: string }

// Sends an event to all WebSocket clients connected under the given familyId.
// The FamilyRoom Durable Object holds all connections for a family.
export async function broadcastToFamily(
  namespace: DurableObjectNamespace,
  familyId: string,
  event: WsEvent,
): Promise<void> {
  const id = namespace.idFromName(familyId)
  const room = namespace.get(id)
  // Fire-and-forget — don't block the response on the broadcast
  room.fetch(new Request('https://do/broadcast', {
    method: 'POST',
    body: JSON.stringify(event),
  })).catch(() => {})
}
