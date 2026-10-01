import { eq, and } from 'drizzle-orm'
import { itemHistory } from '../db/schema.js'
import type { AppDB } from '../db/index.js'

/**
 * Canonical key for "is this the same product?": case, spacing and simple plurals
 * are ignored, so "Carrots", "carrot " and "carrots" are one item.
 */
export function normalizeItemName(name: string): string {
  const n = name.toLowerCase().trim().replace(/\s+/g, ' ')
  if (n.length <= 3 || /(ss|us)$/.test(n)) return n
  if (/ies$/.test(n)) return n.replace(/ies$/, 'y')
  if (/(oes|ches|shes|xes|sses)$/.test(n)) return n.replace(/es$/, '')
  return n.replace(/s$/, '')
}

async function findHistory(db: AppDB, familyId: string, name: string) {
  const key = normalizeItemName(name)
  const all = await db.query.itemHistory.findMany({ where: eq(itemHistory.familyId, familyId) })
  return all.find((h) => normalizeItemName(h.name) === key)
}

export async function upsertItemHistory(
  db: AppDB,
  familyId: string,
  name: string,
  category: string | null,
  storeId: string | null,
) {
  const nameLower = name.toLowerCase().trim()
  const existing = await findHistory(db, familyId, name)

  if (existing) {
    await db.update(itemHistory).set({
      usageCount: existing.usageCount + 1,
      category: category ?? existing.category,
      storeId: storeId ?? existing.storeId,
      updatedAt: new Date().toISOString(),
    }).where(eq(itemHistory.id, existing.id))
  } else {
    await db.insert(itemHistory).values({ familyId, name: name.trim(), nameLower, category, storeId })
  }
}

export async function getItemSuggestions(db: AppDB, familyId: string, query: string) {
  const items = await db.query.itemHistory.findMany({
    where: eq(itemHistory.familyId, familyId),
    orderBy: (t, { desc }) => [desc(t.usageCount)],
  })
  if (!query.trim()) return items
  return items.filter((i) => i.nameLower.includes(query.toLowerCase().trim())).slice(0, 20)
}

export async function getDefaultStoreForItem(db: AppDB, familyId: string, name: string) {
  const item = await findHistory(db, familyId, name)
  return item?.storeId ?? null
}

export async function getDefaultCategoryForItem(db: AppDB, familyId: string, name: string) {
  const item = await findHistory(db, familyId, name)
  return item?.category ?? null
}

/** Predict a shop from the family's other items in the same category (most-used wins). */
export async function getStoreForCategory(db: AppDB, familyId: string, category: string) {
  const items = await db.query.itemHistory.findMany({
    where: and(eq(itemHistory.familyId, familyId), eq(itemHistory.category, category)),
  })
  const score = new Map<string, number>()
  for (const i of items) {
    if (i.storeId) score.set(i.storeId, (score.get(i.storeId) ?? 0) + i.usageCount)
  }
  let best: string | null = null
  let bestScore = 0
  for (const [id, n] of score) if (n > bestScore) { best = id; bestScore = n }
  return best
}
