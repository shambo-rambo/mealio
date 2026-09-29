import { eq, and } from 'drizzle-orm'
import { itemHistory } from '../db/schema.js'
import type { AppDB } from '../db/index.js'

export async function upsertItemHistory(
  db: AppDB,
  familyId: string,
  name: string,
  category: string | null,
  storeId: string | null,
) {
  const nameLower = name.toLowerCase().trim()
  const existing = await db.query.itemHistory.findFirst({
    where: and(eq(itemHistory.familyId, familyId), eq(itemHistory.nameLower, nameLower)),
  })

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
    limit: 20,
  })
  if (!query.trim()) return items
  return items.filter((i) => i.nameLower.includes(query.toLowerCase().trim()))
}

export async function getDefaultStoreForItem(db: AppDB, familyId: string, name: string) {
  const nameLower = name.toLowerCase().trim()
  const item = await db.query.itemHistory.findFirst({
    where: and(eq(itemHistory.familyId, familyId), eq(itemHistory.nameLower, nameLower)),
  })
  return item?.storeId ?? null
}

export async function getDefaultCategoryForItem(db: AppDB, familyId: string, name: string) {
  const nameLower = name.toLowerCase().trim()
  const item = await db.query.itemHistory.findFirst({
    where: and(eq(itemHistory.familyId, familyId), eq(itemHistory.nameLower, nameLower)),
  })
  return item?.category ?? null
}
