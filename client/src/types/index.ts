// ---------------------------------------------------------------------------
// Shared client-side types
// ---------------------------------------------------------------------------

export interface User {
  id: string
  name: string
  email: string
  avatar: string | null
  familyId: string | null
  role: 'owner' | 'admin' | 'member'
  createdAt: string
}

export interface Family {
  id: string
  name: string
  ownerId: string
  createdAt: string
}

export interface FamilyMember extends User {
  isCurrentUser?: boolean
}

export interface Store {
  id: string
  name: string
  familyId: string
}

export interface ShoppingList {
  id: string
  name: string
  familyId: string
  isPublic: boolean
  createdAt: string
  itemCount?: number
  uncheckedCount?: number
}

export interface ShoppingItem {
  id: string
  listId: string
  name: string
  quantity: number | null
  packageSize: string | null
  category: string | null
  storeId: string | null
  price: number | null
  imageUrl: string | null
  note: string | null
  checked: boolean
  recipeSourceId: string | null
  createdBy: string | null
  updatedAt: string
}

export interface ItemHistorySuggestion {
  id: string
  name: string
  category: string | null
  storeId: string | null
  usageCount: number
}

export interface Ingredient {
  id: string
  recipeId: string
  name: string
  quantity: number | null
  unit: string | null
  prepNote: string | null
  sortOrder: number
}

export interface RecipeStep {
  id: string
  recipeId: string
  instruction: string
  sortOrder: number
}

export interface RecipeRating {
  id: string
  recipeId: string
  userId: string
  rating: number
}

export interface Collection {
  id: string
  name: string
  familyId: string
  createdBy: string | null
}

export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten_free' | 'dairy_free' | 'nut_free'

export interface Nutrition {
  id: string
  recipeId: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  perServings: number
}

export interface Recipe {
  id: string
  familyId: string
  title: string
  sourceUrl: string | null
  pictureUrl: string | null
  prepTime: number | null
  cookTime: number | null
  servings: number
  notes: string | null
  createdBy: string | null
  lastPreparedAt: string | null
  preparedCount: number
  shareToken: string | null
  createdAt: string
  // Relations (populated by API)
  ingredients?: Ingredient[]
  steps?: RecipeStep[]
  ratings?: RecipeRating[]
  averageRating?: number
  userRating?: number
  collections?: Collection[]
  dietaryTags?: DietaryTag[]
  nutrition?: Nutrition | null
}

export type MealLabel = 'breakfast' | 'lunch' | 'dinner'

export interface MealPlanEntry {
  id: string
  familyId: string
  date: string // YYYY-MM-DD
  mealLabel: MealLabel
  recipeId: string | null
  noteText: string | null
  dayNote: string | null
  isRecurring: boolean
  recurrenceRule: string | null
  parentId: string | null
  createdBy: string | null
  // Relations
  recipe?: Pick<Recipe, 'id' | 'title' | 'pictureUrl' | 'prepTime' | 'cookTime'>
}

export interface RecipeImportResult {
  title: string
  description?: string | null
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
  dietaryTags: DietaryTag[]
  thumbnailUrl?: string | null
  nutrition: {
    calories: number | null
    protein: number | null
    carbs: number | null
    fat: number | null
  } | null
}

// ---------------------------------------------------------------------------
// WebSocket event types (mirrors server/src/lib/ws.ts)
// ---------------------------------------------------------------------------

export type WsEvent =
  | { type: 'list:created' | 'list:updated' | 'list:deleted'; listId: string }
  | { type: 'list:item:added' | 'list:item:updated' | 'list:item:deleted'; listId: string; itemId: string }
  | { type: 'meal-plan:updated'; familyId: string }
  | { type: 'recipe:created' | 'recipe:updated' | 'recipe:deleted'; recipeId: string }

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface ApiError {
  error: {
    code: string
    message: string
  }
}

export const CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat & Seafood',
  'Bakery',
  'Pantry',
  'Beverages',
  'Frozen',
  'Snacks',
  'Health & Beauty',
  'Household',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]

export interface PendingMealPlan {
  date: string
  mealLabel: MealLabel
}

export interface SuggestMessage {
  role: 'user' | 'assistant'
  content: string
}

export type SuggestTurnRequest = {
  mealLabel: MealLabel
  messages: SuggestMessage[]
}

export type SuggestTurnResponse =
  | { type: 'question'; text: string }
  | { type: 'recipe'; importResult: RecipeImportResult }

export const DIETARY_TAG_LABELS: Record<DietaryTag, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  gluten_free: 'Gluten Free',
  dairy_free: 'Dairy Free',
  nut_free: 'Nut Free',
}
