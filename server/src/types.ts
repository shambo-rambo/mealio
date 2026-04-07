import type { drizzle } from 'drizzle-orm/d1'
import type * as schema from './db/schema.js'
import type { AuthUser } from './middleware/auth.js'

export type Bindings = {
  DB: D1Database
  R2: R2Bucket
  FAMILY_ROOM: DurableObjectNamespace
}

export type AppDB = ReturnType<typeof drizzle<typeof schema>>

export type AppEnv = {
  Bindings: Bindings
  Variables: {
    user: AuthUser
    db: AppDB
  }
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
    db: AppDB
  }
}

export interface RecipeImportResult {
  title: string
  sourceUrl: string | null
  servings: number
  prepTime: number | null
  cookTime: number | null
  ingredients: Array<{
    name: string
    quantity: number | null
    unit: string | null
    prepNote: string | null
  }>
  steps: Array<{ instruction: string }>
  dietaryTags: Array<'vegetarian' | 'vegan' | 'gluten_free' | 'dairy_free' | 'nut_free'>
  nutrition: {
    calories: number | null
    protein: number | null
    carbs: number | null
    fat: number | null
  } | null
}
