import type { drizzle } from 'drizzle-orm/d1'
import type * as schema from './db/schema.js'
import type { AuthUser } from './middleware/auth.js'

export type Bindings = {
  DB: D1Database
  R2: R2Bucket
  FAMILY_ROOM: DurableObjectNamespace
  JWT_SECRET: string
  ANTHROPIC_API_KEY: string
  TYPESAFE_API_KEY: string
  YOUTUBE_API_KEY: string
  INSTAGRAM_TOKEN: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_EMAIL: string
  APP_URL: string
}

export interface VideoData {
  title: string
  description: string
  transcript: string | null
  creator: string
  thumbnailUrl?: string | null
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
  thumbnailUrl?: string | null
  nutrition: {
    calories: number | null
    protein: number | null
    carbs: number | null
    fat: number | null
  } | null
}
