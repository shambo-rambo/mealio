import { Hono } from 'hono'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { shoppingLists, shoppingItems, itemHistory, itemLines } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { upsertItemHistory, normalizeItemName, getItemSuggestions, getDefaultStoreForItem, getDefaultCategoryForItem } from '../lib/itemHistory.js'
import { broadcastToFamily } from '../lib/ws.js'
import { pushToFamily } from '../lib/push.js'
import { suggestItemCategory } from '../lib/ai.js'
import { parseAmount, normalizeUnit } from '../lib/amounts.js'
import type { AppEnv } from '../types.js'
import type { AppDB } from '../db/index.js'

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

listsRoutes.delete('/suggestions/:id', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'forbidden', message: 'No family' } }, 403)
  await db.delete(itemHistory)
    .where(and(eq(itemHistory.id, c.req.param('id')), eq(itemHistory.familyId, familyId)))
  return c.json({ ok: true })
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
  return c.json({ items: await attachLines(db, items) })
})

// Collapse rows that are really the same product (e.g. five "Carrots") into one.
// Keeps the open row (else the newest), merges notes, drops the rest. Safe to call repeatedly.
listsRoutes.post('/:id/merge-duplicates', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const listId = c.req.param('id')
  const list = await db.query.shoppingLists.findFirst({
    where: and(eq(shoppingLists.id, listId), eq(shoppingLists.familyId, familyId!)),
  })
  if (!list) return c.json({ error: { code: 'not_found', message: 'List not found' } }, 404)

  const items = await db.query.shoppingItems.findMany({ where: eq(shoppingItems.listId, listId) })
  const groups = new Map<string, typeof items>()
  for (const item of items) {
    const key = normalizeItemName(item.name)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  let removed = 0
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const keep = [...group].sort((a, b) =>
      Number(a.checked) - Number(b.checked) || b.updatedAt.localeCompare(a.updatedAt))[0]
    const notes = [...new Set(group.flatMap((i) => (i.note ? i.note.split('\n') : [])))]
    const merged = notes.join('\n') || null
    await db.update(shoppingItems)
      .set({ note: merged, category: keep.category ?? group.find((i) => i.category)?.category ?? null })
      .where(eq(shoppingItems.id, keep.id))
    for (const dupe of group) {
      if (dupe.id === keep.id) continue
      await db.update(itemLines).set({ itemId: keep.id }).where(eq(itemLines.itemId, dupe.id))
      await db.delete(shoppingItems).where(eq(shoppingItems.id, dupe.id))
      removed++
    }
  }
  if (removed > 0) await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:updated', listId, itemId: '' })
  return c.json({ removed })
})

const recipeNeedSchema = z.object({
  id: z.string().nullish(),
  title: z.string().max(200),
  amount: z.string().max(100).default(''),
  quantity: z.number().nullish(),
  unit: z.string().max(30).nullish(),
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
  // The usual amount the user wants ("1 kg"). Becomes the item's manual line.
  amount: z.string().max(100).nullish(),
  // Set when a recipe (not the user) is asking for the item. Becomes a recipe line.
  recipe: recipeNeedSchema.nullish(),
})

type Line = typeof itemLines.$inferSelect

async function attachLines<T extends { id: string }>(db: AppDB, items: T[]) {
  if (items.length === 0) return items.map((i) => ({ ...i, lines: [] as Line[] }))
  const lines = await db.query.itemLines.findMany({
    where: inArray(itemLines.itemId, items.map((i) => i.id)),
    orderBy: [asc(itemLines.createdAt)],
  })
  return items.map((i) => ({ ...i, lines: lines.filter((l) => l.itemId === i.id) }))
}

async function withLines<T extends { id: string }>(db: AppDB, item: T) {
  return (await attachLines(db, [item]))[0]
}

/** Turn the old free-text package size into a proper "usual buy" line (once). */
async function ensureBaseLine(db: AppDB, item: typeof shoppingItems.$inferSelect, lines: Line[]) {
  if (lines.some((l) => l.source === 'manual') || !item.packageSize) return lines
  const p = parseAmount(item.packageSize)
  const [line] = await db.insert(itemLines).values({
    itemId: item.id, source: 'manual', amount: p.amount, quantity: p.quantity, unit: p.unit, selected: true,
  }).returning()
  return [...lines, line]
}

async function upsertRecipeLine(
  db: AppDB,
  itemId: string,
  lines: Line[],
  recipe: z.infer<typeof recipeNeedSchema>,
  selectedDefault: boolean,
) {
  const values = { amount: recipe.amount, quantity: recipe.quantity ?? null, unit: normalizeUnit(recipe.unit) }
  const existing = lines.find((l) => l.source === 'recipe' && (recipe.id ? l.recipeId === recipe.id : l.sourceName === recipe.title))
  if (existing) {
    await db.update(itemLines).set(values).where(eq(itemLines.id, existing.id))
    return
  }
  await db.insert(itemLines).values({
    itemId, source: 'recipe', sourceName: recipe.title, recipeId: recipe.id ?? null, selected: selectedDefault, ...values,
  })
}

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

  const { name, quantity, amount, recipe, ...rest } = result.data
  const key = normalizeItemName(name)
  const existing = await db.query.shoppingItems.findMany({ where: eq(shoppingItems.listId, listId) })
  // One row per product. Prefer the open row; otherwise the bought one (it's "in the pantry").
  const matches = existing.filter((i) => normalizeItemName(i.name) === key)
  const dup = matches.find((i) => !i.checked) ?? matches[0]

  if (dup) {
    // Never sum quantities across sources: a recipe's "1 carrot" is its own line on a 1 kg item.
    const wasChecked = dup.checked
    let lines = await db.query.itemLines.findMany({ where: eq(itemLines.itemId, dup.id) })
    lines = await ensureBaseLine(db, dup, lines)
    if (amount && !lines.some((l) => l.source === 'manual')) {
      const p = parseAmount(amount)
      await db.insert(itemLines).values({ itemId: dup.id, source: 'manual', amount: p.amount, quantity: p.quantity, unit: p.unit })
    }
    if (recipe) {
      // Already have a ticked "usual buy"? Then the recipe's amount is probably covered: add it unticked.
      const covered = lines.some((l) => l.source === 'manual' && l.selected)
      await upsertRecipeLine(db, dup.id, lines, recipe, !covered)
    }
    const [updated] = await db.update(shoppingItems)
      .set({ checked: false, updatedAt: new Date().toISOString() })
      .where(eq(shoppingItems.id, dup.id))
      .returning()
    await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:updated', listId, itemId: dup.id })
    return c.json({ item: await withLines(db, updated), deduplicated: !wasChecked, reopened: wasChecked })
  }

  const defaultStoreId = rest.storeId ?? await getDefaultStoreForItem(db, familyId!, name)
  // Use previously-learned category so repeat items are categorised immediately
  const defaultCategory = rest.category ?? await getDefaultCategoryForItem(db, familyId!, name)

  const [item] = await db.insert(shoppingItems).values({
    listId, name: name.trim(), quantity: quantity ?? null, storeId: defaultStoreId, category: defaultCategory, createdBy: userId,
    ...rest,
  }).returning()

  if (amount) {
    const p = parseAmount(amount)
    await db.insert(itemLines).values({ itemId: item.id, source: 'manual', amount: p.amount, quantity: p.quantity, unit: p.unit })
  }
  if (recipe) await upsertRecipeLine(db, item.id, [], recipe, true)

  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:added', listId, itemId: item.id })

  // Fire-and-forget AI category suggestion for items with no known category
  if (!defaultCategory) {
    c.executionCtx.waitUntil(
      suggestItemCategory(name, c.env.ANTHROPIC_API_KEY).then(async (cat) => {
        await db.update(shoppingItems).set({ category: cat }).where(eq(shoppingItems.id, item.id))
        // Save to history now that we have a real category
        await upsertItemHistory(db, familyId!, name, cat, defaultStoreId)
        await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:updated', listId, itemId: item.id })
      }).catch(() => {}),
    )
  } else {
    // Category already known — persist usage count + store preference
    await upsertItemHistory(db, familyId!, name, defaultCategory, defaultStoreId)
  }

  return c.json({ item: await withLines(db, item) }, 201)
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

  const { amount: _amount, recipe: _recipe, ...patch } = result.data

  const [item] = await db.update(shoppingItems)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(shoppingItems.id, itemId), eq(shoppingItems.listId, listId)))
    .returning()
  if (!item) return c.json({ error: { code: 'not_found', message: 'Item not found' } }, 404)

  if (result.data.category || result.data.storeId) {
    await upsertItemHistory(db, familyId!, item.name, item.category, item.storeId)
  }

  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:updated', listId, itemId })

  if (result.data.checked === true) {
    // Bought: the recipe lines are done; the usual amount stays for next time
    await db.delete(itemLines).where(and(eq(itemLines.itemId, itemId), eq(itemLines.source, 'recipe')))
    // Bought: make sure it's back in the pantry (re-creates it if it was swiped away)
    await upsertItemHistory(db, familyId!, item.name, item.category, item.storeId)
    c.executionCtx.waitUntil(
      pushToFamily(db, familyId!, {
        title: 'Item checked off',
        body: `${item.name} marked as purchased`,
        tag: `list-item-${itemId}`,
        url: `/shopping/${listId}`,
      }, c.get('user').userId).catch(() => {}),
    )
  }

  return c.json({ item: await withLines(db, item) })
})

// ── Item lines (the itemised amounts behind an item) ──────────────────────────

async function ownedItem(c: any, listId: string, itemId: string) {
  const db = c.get('db') as AppDB
  const { familyId } = c.get('user')
  const list = await db.query.shoppingLists.findFirst({
    where: and(eq(shoppingLists.id, listId), eq(shoppingLists.familyId, familyId!)),
  })
  if (!list) return null
  return (await db.query.shoppingItems.findFirst({
    where: and(eq(shoppingItems.id, itemId), eq(shoppingItems.listId, listId)),
  })) ?? null
}

const lineSchema = z.object({ amount: z.string().max(100).optional(), selected: z.boolean().optional() })

listsRoutes.post('/:id/items/:itemId/lines', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const listId = c.req.param('id'), itemId = c.req.param('itemId')
  const item = await ownedItem(c, listId, itemId)
  if (!item) return c.json({ error: { code: 'not_found', message: 'Item not found' } }, 404)
  const result = lineSchema.safeParse(await c.req.json().catch(() => null))
  if (!result.success || !result.data.amount?.trim()) return c.json({ error: { code: 'validation_error', message: 'Amount required' } }, 400)
  const p = parseAmount(result.data.amount)
  await db.insert(itemLines).values({ itemId, source: 'manual', amount: p.amount, quantity: p.quantity, unit: p.unit })
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:updated', listId, itemId })
  return c.json({ item: await withLines(db, item) }, 201)
})

listsRoutes.patch('/:id/items/:itemId/lines/:lineId', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const listId = c.req.param('id'), itemId = c.req.param('itemId'), lineId = c.req.param('lineId')
  const item = await ownedItem(c, listId, itemId)
  if (!item) return c.json({ error: { code: 'not_found', message: 'Item not found' } }, 404)
  const result = lineSchema.safeParse(await c.req.json().catch(() => null))
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Invalid data' } }, 400)
  const set: Partial<typeof itemLines.$inferInsert> = {}
  if (result.data.selected !== undefined) set.selected = result.data.selected
  if (result.data.amount !== undefined) {
    const p = parseAmount(result.data.amount)
    Object.assign(set, { amount: p.amount, quantity: p.quantity, unit: p.unit })
  }
  if (Object.keys(set).length > 0) {
    await db.update(itemLines).set(set).where(and(eq(itemLines.id, lineId), eq(itemLines.itemId, itemId)))
  }
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:updated', listId, itemId })
  return c.json({ item: await withLines(db, item) })
})

listsRoutes.delete('/:id/items/:itemId/lines/:lineId', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const listId = c.req.param('id'), itemId = c.req.param('itemId'), lineId = c.req.param('lineId')
  const item = await ownedItem(c, listId, itemId)
  if (!item) return c.json({ error: { code: 'not_found', message: 'Item not found' } }, 404)
  await db.delete(itemLines).where(and(eq(itemLines.id, lineId), eq(itemLines.itemId, itemId)))
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'list:item:updated', listId, itemId })
  return c.json({ item: await withLines(db, item) })
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

  const key = normalizeItemName(result.data.name)
  const existing = await db.query.shoppingItems.findMany({ where: eq(shoppingItems.listId, listId) })
  const matches = existing.filter((i) => normalizeItemName(i.name) === key)
  const dup = matches.find((i) => !i.checked) ?? matches[0]

  if (dup) {
    const [updated] = await db.update(shoppingItems)
      .set({ checked: false, updatedAt: new Date().toISOString() })
      .where(eq(shoppingItems.id, dup.id))
      .returning()
    return c.json({ item: updated })
  }

  const [item] = await db.insert(shoppingItems).values({ listId, name: result.data.name.trim() }).returning()
  return c.json({ item }, 201)
})
