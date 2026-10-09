import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import {
  recipes, ingredients, recipeSteps, recipeRatings,
  collections, recipeCollections, dietaryTags, nutrition,
} from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  parseRecipeFromUrl, parseRecipeFromText, parseRecipeFromPhoto,
  parseRecipeFromSocialVideo,
  generateDietaryTags, estimateNutrition, withNutrition,
} from '../lib/ai.js'
import { detectPlatform } from '../lib/detect.js'
import { fetchInstagramData } from '../lib/extractors/instagram.js'
import { fetchTikTokData } from '../lib/extractors/tiktok.js'
import { fetchYouTubeData } from '../lib/extractors/youtube.js'
import { broadcastToFamily } from '../lib/ws.js'
import type { AppEnv, AppDB } from '../types.js'

export const recipesRoutes = new Hono<AppEnv>()
recipesRoutes.use('*', authMiddleware)

// D1 caps bound parameters at 100 per statement. Split multi-row inserts into
// chunks sized so that (rows × columnsPerRow) stays comfortably below that limit.
function inChunks<T>(arr: T[], colsPerRow: number): T[][] {
  const size = Math.max(1, Math.floor(99 / colsPerRow))
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getRecipeFull(db: AppDB, id: string, userId: string) {
  const recipe = await db.query.recipes.findFirst({ where: eq(recipes.id, id) })
  if (!recipe) return null

  const [ings, steps, ratings, cols, tags, nut] = await Promise.all([
    db.query.ingredients.findMany({ where: eq(ingredients.recipeId, id), orderBy: (t, { asc }) => [asc(t.sortOrder)] }),
    db.query.recipeSteps.findMany({ where: eq(recipeSteps.recipeId, id), orderBy: (t, { asc }) => [asc(t.sortOrder)] }),
    db.query.recipeRatings.findMany({ where: eq(recipeRatings.recipeId, id) }),
    db.query.recipeCollections.findMany({ where: eq(recipeCollections.recipeId, id) }),
    db.query.dietaryTags.findMany({ where: eq(dietaryTags.recipeId, id) }),
    db.query.nutrition.findFirst({ where: eq(nutrition.recipeId, id) }),
  ])

  const colDetails = await Promise.all(
    cols.map((rc) => db.query.collections.findFirst({ where: eq(collections.id, rc.collectionId) }))
  )

  const averageRating = ratings.length
    ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
    : null
  const userRating = ratings.find((r) => r.userId === userId)?.rating ?? null

  return {
    ...recipe,
    ingredients: ings,
    steps,
    ratings,
    averageRating,
    userRating,
    collections: colDetails.filter(Boolean),
    dietaryTags: tags.map((t) => t.tag),
    nutrition: nut ?? null,
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

recipesRoutes.get('/', async (c) => {
  const db = c.get('db')
  const { familyId, userId } = c.get('user')
  if (!familyId) return c.json({ recipes: [] })

  const search = c.req.query('search')
  const collectionId = c.req.query('collection')
  const tag = c.req.query('tag')

  let recipeList = await db.query.recipes.findMany({
    where: eq(recipes.familyId, familyId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  if (search) {
    recipeList = recipeList.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
  }

  const withMeta = await Promise.all(
    recipeList.map(async (recipe) => {
      const [ratings, tags, nut] = await Promise.all([
        db.query.recipeRatings.findMany({ where: eq(recipeRatings.recipeId, recipe.id) }),
        db.query.dietaryTags.findMany({ where: eq(dietaryTags.recipeId, recipe.id) }),
        db.query.nutrition.findFirst({ where: eq(nutrition.recipeId, recipe.id) }),
      ])
      const avg = ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : null
      return {
        ...recipe,
        averageRating: avg,
        userRating: ratings.find((r) => r.userId === userId)?.rating ?? null,
        dietaryTags: tags.map((t) => t.tag),
        calories: nut?.calories ?? null,
      }
    })
  )

  let filtered = withMeta
  if (tag) filtered = filtered.filter((r) => r.dietaryTags.includes(tag as any))
  if (collectionId) {
    const memberships = await db.query.recipeCollections.findMany({
      where: eq(recipeCollections.collectionId, collectionId),
    })
    const allowed = new Set(memberships.map((m) => m.recipeId))
    filtered = filtered.filter((r) => allowed.has(r.id))
  }

  return c.json({ recipes: filtered })
})

recipesRoutes.get('/:id', async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const id = c.req.param('id')
  const recipe = await getRecipeFull(db, id, userId)
  if (!recipe) return c.json({ error: { code: 'not_found', message: 'Recipe not found' } }, 404)
  return c.json({ recipe })
})

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  prepNote: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
})

const recipeBodySchema = z.object({
  title: z.string().min(1).max(200),
  sourceUrl: z.string().nullable().optional(),
  pictureUrl: z.string().nullable().optional(),
  servings: z.number().int().min(1).default(4),
  prepTime: z.number().nullable().optional(),
  cookTime: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  ingredients: z.array(ingredientSchema).optional(),
  steps: z.array(z.object({ instruction: z.string().min(1) })).optional(),
  dietaryTags: z.array(z.string()).optional(),
  nutrition: z.object({
    calories: z.number().nullable().optional(),
    protein: z.number().nullable().optional(),
    carbs: z.number().nullable().optional(),
    fat: z.number().nullable().optional(),
  }).nullable().optional(),
  collectionIds: z.array(z.string()).optional(),
})

recipesRoutes.post('/', async (c) => {
  const db = c.get('db')
  const { familyId, userId } = c.get('user')
  if (!familyId) return c.json({ error: { code: 'no_family', message: 'Not in a family' } }, 400)

  const body = await c.req.json().catch(() => null)
  const result = recipeBodySchema.safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: result.error.issues[0].message } }, 400)

  const { ingredients: ings, steps, dietaryTags: tags, nutrition: nutIn, collectionIds, ...recipeData } = result.data

  // Backfill calories (pasted JSON, manual entry, etc.) when none were provided
  let nut = nutIn
  if (nut?.calories == null && ings?.length) {
    const est = await estimateNutrition(
      ings.map((i) => ({ name: i.name, quantity: i.quantity ?? null, unit: i.unit ?? null })),
      recipeData.servings,
      c.env.AI_GATEWAY_API_KEY,
    )
    if (est) nut = est
  }

  const recipeId = crypto.randomUUID()
  await db.insert(recipes).values({ id: recipeId, familyId, createdBy: userId, ...recipeData })

  // ingredients: 7 cols (id, recipeId, name, quantity, unit, prepNote, sortOrder) → 14 rows/chunk
  if (ings?.length) {
    const rows = ings.map((ing, i) => ({ recipeId, sortOrder: i, ...ing }))
    for (const chunk of inChunks(rows, 7)) await db.insert(ingredients).values(chunk)
  }

  // steps: 4 cols (id, recipeId, instruction, sortOrder) → 24 rows/chunk
  if (steps?.length) {
    const rows = steps.map((s, i) => ({ recipeId, instruction: s.instruction, sortOrder: i }))
    for (const chunk of inChunks(rows, 4)) await db.insert(recipeSteps).values(chunk)
  }

  // tags: 3 cols (id, recipeId, tag) → 33 rows/chunk
  if (tags?.length) {
    const rows = tags.map((tag) => ({ recipeId, tag: tag as any }))
    for (const chunk of inChunks(rows, 3)) await db.insert(dietaryTags).values(chunk)
  }

  if (nut) await db.insert(nutrition).values({ recipeId, ...nut, perServings: recipeData.servings })

  // collections: 2 cols (recipeId, collectionId) → 49 rows/chunk
  if (collectionIds?.length) {
    const rows = collectionIds.map((cid) => ({ recipeId, collectionId: cid }))
    for (const chunk of inChunks(rows, 2)) await db.insert(recipeCollections).values(chunk)
  }

  const recipe = await getRecipeFull(db, recipeId, userId)
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId, { type: 'recipe:created', recipeId })
  return c.json({ recipe }, 201)
})

recipesRoutes.patch('/:id', async (c) => {
  const db = c.get('db')
  const { familyId, userId } = c.get('user')
  const id = c.req.param('id')

  const existing = await db.query.recipes.findFirst({
    where: and(eq(recipes.id, id), eq(recipes.familyId, familyId!)),
  })
  if (!existing) return c.json({ error: { code: 'not_found', message: 'Recipe not found' } }, 404)

  const body = await c.req.json().catch(() => null)
  const result = recipeBodySchema.partial().safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: result.error.issues[0].message } }, 400)

  const { ingredients: ings, steps, dietaryTags: tags, nutrition: nut, collectionIds, ...recipeData } = result.data

  if (Object.keys(recipeData).length) await db.update(recipes).set(recipeData).where(eq(recipes.id, id))
  if (ings) {
    await db.delete(ingredients).where(eq(ingredients.recipeId, id))
    if (ings.length) {
      const rows = ings.map((ing, i) => ({ recipeId: id, sortOrder: i, ...ing }))
      for (const chunk of inChunks(rows, 7)) await db.insert(ingredients).values(chunk)
    }
  }
  if (steps) {
    await db.delete(recipeSteps).where(eq(recipeSteps.recipeId, id))
    if (steps.length) {
      const rows = steps.map((s, i) => ({ recipeId: id, instruction: s.instruction, sortOrder: i }))
      for (const chunk of inChunks(rows, 4)) await db.insert(recipeSteps).values(chunk)
    }
  }
  if (tags) {
    await db.delete(dietaryTags).where(eq(dietaryTags.recipeId, id))
    if (tags.length) {
      const rows = tags.map((t) => ({ recipeId: id, tag: t as any }))
      for (const chunk of inChunks(rows, 3)) await db.insert(dietaryTags).values(chunk)
    }
  }
  if (nut !== undefined) {
    await db.delete(nutrition).where(eq(nutrition.recipeId, id))
    if (nut) await db.insert(nutrition).values({ recipeId: id, ...nut, perServings: result.data.servings ?? existing.servings })
  }
  if (collectionIds) {
    await db.delete(recipeCollections).where(eq(recipeCollections.recipeId, id))
    if (collectionIds.length) {
      const rows = collectionIds.map((cid) => ({ recipeId: id, collectionId: cid }))
      for (const chunk of inChunks(rows, 2)) await db.insert(recipeCollections).values(chunk)
    }
  }

  const recipe = await getRecipeFull(db, id, userId)
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'recipe:updated', recipeId: id })
  return c.json({ recipe })
})

recipesRoutes.delete('/:id', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const id = c.req.param('id')
  await db.delete(recipes).where(and(eq(recipes.id, id), eq(recipes.familyId, familyId!)))
  await broadcastToFamily(c.env.FAMILY_ROOM, familyId!, { type: 'recipe:deleted', recipeId: id })
  return c.json({ ok: true })
})

recipesRoutes.post('/:id/share', async (c) => {
  const db = c.get('db')
  const { familyId } = c.get('user')
  const id = c.req.param('id')

  const existing = await db.query.recipes.findFirst({
    where: and(eq(recipes.id, id), eq(recipes.familyId, familyId!)),
  })
  if (!existing) return c.json({ error: { code: 'not_found', message: 'Recipe not found' } }, 404)

  const token = existing.shareToken ?? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  if (!existing.shareToken) {
    await db.update(recipes).set({ shareToken: token }).where(eq(recipes.id, id))
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  return c.json({ shareToken: token, url: `${appUrl}/r/${token}` })
})

// ── AI import ─────────────────────────────────────────────────────────────────

recipesRoutes.post('/import', async (c) => {
  const body = await c.req.json().catch(() => null)
  const result = z.object({
    type: z.enum(['url', 'text', 'photo']),
    payload: z.string().min(1),
    mediaType: z.string().optional(),
  }).safeParse(body)

  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'type and payload required' } }, 400)

  const { type, payload, mediaType } = result.data
  const anthropicKey = c.env.ANTHROPIC_API_KEY
  try {
    let parsed
    if (type === 'url') {
      const platform = detectPlatform(payload)
      if (platform === 'instagram') {
        const igToken = c.env.INSTAGRAM_TOKEN
        if (!igToken) return c.json({ error: { code: 'import_failed', message: 'Instagram import not configured' } }, 502)
        const igData = await fetchInstagramData(payload, igToken)
        parsed = { ...await parseRecipeFromSocialVideo(igData, payload, anthropicKey), thumbnailUrl: igData.thumbnailUrl ?? null }
      } else if (platform === 'tiktok') {
        const ttData = await fetchTikTokData(payload)
        parsed = { ...await parseRecipeFromSocialVideo(ttData, payload, anthropicKey), thumbnailUrl: ttData.thumbnailUrl ?? null }
      } else if (platform === 'youtube') {
        const key = c.env.YOUTUBE_API_KEY
        if (!key) return c.json({ error: { code: 'import_failed', message: 'YouTube import not configured' } }, 502)
        const ytData = await fetchYouTubeData(payload, key)
        parsed = { ...await parseRecipeFromSocialVideo(ytData, payload, anthropicKey), thumbnailUrl: ytData.thumbnailUrl ?? null }
      } else {
        parsed = await parseRecipeFromUrl(payload, anthropicKey)
      }
    } else if (type === 'photo') {
      parsed = await parseRecipeFromPhoto(payload, mediaType ?? 'image/jpeg', anthropicKey)
    } else {
      parsed = await parseRecipeFromText(payload, anthropicKey)
    }
    return c.json({ result: await withNutrition(parsed, c.env.AI_GATEWAY_API_KEY) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Import failed'
    if (msg === 'no_recipe_found') {
      return c.json({ error: { code: 'no_recipe_found', message: 'No recipe found in this post' } }, 422)
    }
    if (msg === 'post_unavailable') {
      return c.json({ error: { code: 'post_unavailable', message: 'This post is private or unavailable' } }, 422)
    }
    return c.json({ error: { code: 'import_failed', message: msg } }, 502)
  }
})

// ── Ratings ───────────────────────────────────────────────────────────────────

recipesRoutes.post('/:id/rate', async (c) => {
  const db = c.get('db')
  const { userId } = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const result = z.object({ rating: z.number().int().min(1).max(5) }).safeParse(body)
  if (!result.success) return c.json({ error: { code: 'validation_error', message: 'Rating 1-5 required' } }, 400)

  const existing = await db.query.recipeRatings.findFirst({
    where: and(eq(recipeRatings.recipeId, id), eq(recipeRatings.userId, userId)),
  })
  if (existing) {
    await db.update(recipeRatings).set({ rating: result.data.rating }).where(eq(recipeRatings.id, existing.id))
  } else {
    await db.insert(recipeRatings).values({ recipeId: id, userId, rating: result.data.rating })
  }

  const allRatings = await db.query.recipeRatings.findMany({ where: eq(recipeRatings.recipeId, id) })
  const avg = allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length
  return c.json({ averageRating: avg, userRating: result.data.rating })
})

// ── Public share ──────────────────────────────────────────────────────────────

export const publicRecipesRoutes = new Hono<AppEnv>()

publicRecipesRoutes.get('/recipes/:token', async (c) => {
  const db = c.get('db')
  const token = c.req.param('token')
  const recipe = await db.query.recipes.findFirst({ where: eq(recipes.shareToken, token) })
  if (!recipe) return c.json({ error: { code: 'not_found', message: 'Recipe not found' } }, 404)
  const full = await getRecipeFull(db, recipe.id, '')
  return c.json({ recipe: full })
})
