import { Hono } from 'hono'
import { eq, and, asc } from 'drizzle-orm'
import { z } from 'zod'
import { shoppingLists, shoppingItems, itemHistory } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { upsertItemHistory, getItemSuggestions, getDefaultStoreForItem } from '../lib/itemHistory.js'
import { broadcastToFamily } from '../lib/ws.js'
import { pushToFamily } from '../lib/push.js'
import { suggestItemCategory } from '../lib/ai.js'
import type { AppEnv } from '../types.js'

export const listsRoutes = new Hono<AppEnv>()
listsRoutes.use('*', authMiddleware)

// ── Lists ─────────────────────────────────────────────────────────────────────

listsRoutes.get('/', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  if (!familyId) return c.json({ lists: [] })

  const lists = await db.query.shoppingLists.findMany({
    where: eq(shoppingLists.familyId, familyId),
    orderBy: [asc(shoppingLists.createdAt)],
  })

  const withCounts = await Promise.all(
    lists.map(async (list) => {
      const items = await db.query.shoppingItems.findMany({
        where: eq(shoppingItems.listId, list.id),
        columns: { checked: true },
      })
      return { ...list, itemCount: items.length, uncheckedCount: items.filter((i) => !i.checked).length }
    }),
  )
  return c.json({ lists: withCounts })
})

listsRoutes.post('/', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 400)

  const body = await c.req.json().catch(() => null)
  const result = z.object({ name: z.string().min(1).max(100) }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Name required' } }, 400)

  const [list] = await db.insert(shoppingLists).values({ name: result.data.name, familyId }).returning()
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId, { type: 'list:created', listId: list.id })
  return c.json({ list: { ...list, itemCount: 0, uncheckedCount: 0 } }, 201)
})

listsRoutes.get('/suggestions', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  if (!familyId) return c.json({ suggestions: [] })
  const query = c.req.query('q') ?? ''
  const suggestions = await getItemSuggestions(db, familyId, query)
  return c.json({ suggestions })
})

listsRoutes.get('/:id', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const id = c.req.param('id')
  const list = await db.query.shoppingLists.findFirst({
    where: and(eq(shoppingLists.id, id), eq(shoppingLists.familyId, familyId!)),
  })
  if (!list) return c.json({ error: { code: 'not_found', message: 'List not found' } }, 404)
  return c.json({ list })
})

listsRoutes.patch('/:id', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const result = z.object({ name: z.string().min(1).max(100).optional(), isPublic: z.boolean().optional() }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Invalid data' } }, 400)

  const [list] = await db.update(shoppingLists)
    .set(result.data)
    .where(and(eq(shoppingLists.id, id), eq(shoppingLists.familyId, familyId!)))
    .returning()
  if (list) await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:updated', listId: id })
  return c.json({ list })
})

listsRoutes.delete('/:id', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const id = c.req.param('id')
  await db.delete(shoppingLists).where(and(eq(shoppingLists.id, id), eq(shoppingLists.familyId, familyId!)))
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:deleted', listId: id })
  return c.json({ ok: true })
})

// ── Items ─────────────────────────────────────────────────────────────────────

listsRoutes.get('/:id/items', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const listId = c.req.param('id')

  const list = await db.query.shoppingLists.findFirst({
    where: and(eq(shoppingLists.id, listId), eq(shoppingLists.familyId, familyId!)),
  })
  if (!list) return c.json({ error: { code: 'not_found', message: 'List not found' } }, 404)

  const items = await db.query.shoppingItems.findMany({
    where: eq(shoppingItems.listId, listId),
    orderBy: [asc(shoppingItems.checked), asc(shoppingItems.category), asc(shoppingItems.name)],
  })
  return c.json({ items })
})

const itemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().nullable().optional(),
  packageSize: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  storeId: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  recipeSourceId: z.string().nullable().optional(),
})

listsRoutes.post('/:id/items', async (c) => {
  const db = c.get('db')
  const { familyId, userId } = c.get('user')
  const listId = c.req.param('id')

  const list = await db.query.shoppingLists.findFirst({
    where: and(eq(shoppingLists.id, listId), eq(shoppingLists.familyId, familyId!)),
  })
  if (!list) return c.json({ error: { code: 'not_found', message: 'List not found' } }, 404)

  const body = await c.req.json().catch(() => null)
  const result = itemSchema.safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: result.error.issues[0].message } }, 400)

  const { name, quantity, ...rest } = result.data
  const normalised = name.toLowerCase().trim()
  const existing = await db.query.shoppingItems.findMany({ where: eq(shoppingItems.listId, listId) })
  const dup = existing.find((i) => i.name.toLowerCase().trim() === normalised && !i.checked)

  if (dup) {
    const newQty = (dup.quantity ?? 1) + (quantity ?? 1)
    const [updated] = await db.update(shoppingItems)
      .set({ quantity: newQty, updatedAt: new Date().toISOString() })
      .where(eq(shoppingItems.id, dup.id))
      .returning()
    await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:updated', listId, itemId: dup.id })
    return c.json({ item: updated, deduplicated: true })
  }

  const defaultStoreId = rest.storeId ?? await getDefaultStoreForItem(db, familyId!, name)

  const [item] = await db.insert(shoppingItems).values({
    listId, name: name.trim(), quantity: quantity ?? null, storeId: defaultStoreId, createdBy: userId, ...rest,
  }).returning()

  await upsertItemHistory(db, familyId!, name, rest.category ?? null, defaultStoreId)
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:added', listId, itemId: item.id })

  // Fire-and-forget AI category suggestion (uses waitUntil so Worker stays alive)
  if (!rest.category) {
    const historyItem = await db.query.itemHistory.findFirst({
      where: and(eq(itemHistory.familyId, familyId!), eq(itemHistory.nameLower, normalised)),
    })
    if (!historyItem?.category) {
      c.executionCtx.waitUntil(
        suggestItemCategory(name).then(async (cat) => {
          await db.update(shoppingItems).set({ category: cat }).where(eq(shoppingItems.id, item.id))
          await upsertItemHistory(db, familyId!, name, cat, defaultStoreId)
          await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:updated', listId, itemId: item.id })
        }).catch(() => {}),
      )
    }
  }

  return c.json({ item }, 201)
})

listsRoutes.patch('/:id/items/:itemId', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const listId = c.req.param('id')
  const itemId = c.req.param('itemId')

  const list = await db.query.shoppingLists.findFirst({
    where: and(eq(shoppingLists.id, listId), eq(shoppingLists.familyId, familyId!)),
  })
  if (!list) return c.json({ error: { code: 'not_found', message: 'List not found' } }, 404)

  const body = await c.req.json().catch(() => null)
  const result = itemSchema.partial().extend({ checked: z.boolean().optional() }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Invalid data' } }, 400)

  const [item] = await db.update(shoppingItems)
    .set({ ...result.data, updatedAt: new Date().toISOString() })
    .where(and(eq(shoppingItems.id, itemId), eq(shoppingItems.listId, listId)))
    .returning()
  if (!item) return c.json({ error: { code: 'not_found', message: 'Item not found' } }, 404)

  if (result.data.category || result.data.storeId) {
    await upsertItemHistory(db, familyId!, item.name, item.category, item.storeId)
  }

  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:updated', listId, itemId })

  if (result.data.checked === true) {
    c.executionCtx.waitUntil(
      pushToFamily(db, familyId!, {
        title: 'Item checked off',
        body: `${item.name} marked as purchased`,
        tag: `list-item-${itemId}`,
        url: `/shopping/${listId}`,
      }, c.get('user').userId).catch(() => {}),
    )
  }

  return c.json({ item })
})

listsRoutes.delete('/:id/items/:itemId', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const listId = c.req.param('id')
  const itemId = c.req.param('itemId')
  await db.delete(shoppingItems).where(and(eq(shoppingItems.id, itemId), eq(shoppingItems.listId, listId)))
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:deleted', listId, itemId })
  return c.json({ ok: true })
})

// ── Public quick-add (no auth) ────────────────────────────────────────────────

export const publicListsRoutes = new Hono<AppEnv>()

publicListsRoutes.post('/lists/:id/items', async (c) => {
  const db = c.get('db')
  const listId = c.req.param('id')
  const list = await db.query.shoppingLists.findFirst({ where: eq(shoppingLists.id, listId) })
  if (!list || !list.isPublic) return c.json({ error: { code: 'not_found', message: 'List not found' } }, 404)

  const body = await c.req.json().catch(() => null)
  const result = z.object({ name: z.string().min(1).max(200) }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Item name required' } }, 400)

  const normalised = result.data.name.toLowerCase().trim()
  const existing = await db.query.shoppingItems.findMany({ where: eq(shoppingItems.listId, listId) })
  const dup = existing.find((i) => i.name.toLowerCase().trim() === normalised && !i.checked)

  if (dup) {
    const [updated] = await db.update(shoppingItems)
      .set({ quantity: (dup.quantity ?? 1) + 1, updatedAt: new Date().toISOString() })
      .where(eq(shoppingItems.id, dup.id))
      .returning()
    return c.json({ item: updated })
  }

  const [item] = await db.insert(shoppingItems).values({ listId, name: result.data.name.trim() }).returning()
  return c.json({ item }, 201)
})
