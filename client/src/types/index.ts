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
  emailVerified?: boolean
  hasPassword?: boolean
  googleLinked?: boolean
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

/** One reason an item is on the list: the usual buy, or a recipe that needs some. */
export interface ItemLine {
  id: string
  itemId: string
  source: 'manual' | 'recipe'
  sourceName: string | null
  recipeId: string | null
  amount: string
  quantity: number | null
  unit: string | null
  selected: boolean
}

export interface ShoppingItem {
  id: string
  listId: string
  name: string
  quantity: number | null
  packageSize: string | null
  category: string | null
  aisle?: string | null
  storeId: string | null
  price: number | null
  imageUrl: string | null
  note: string | null
  checked: boolean
  recipeSourceId: string | null
  createdBy: string | null
  updatedAt: string
  lines?: ItemLine[]
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
  foodGroup?: string | null
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

export const ALLERGENS = ['nuts', 'dairy', 'gluten', 'egg', 'shellfish', 'fish', 'soy', 'sesame'] as const
export type Allergen = (typeof ALLERGENS)[number]
export const ALLERGEN_LABELS: Record<Allergen, string> = {
  nuts: 'Nuts', dairy: 'Dairy', gluten: 'Gluten', egg: 'Egg', shellfish: 'Shellfish', fish: 'Fish', soy: 'Soy', sesame: 'Sesame',
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
  // Jev-assigned tags (null until classified)
  mealType?: string | null
  effort?: string | null
  protein?: string | null
  cuisine?: string | null
  kidFriendly?: boolean | null
  allergens?: Allergen[]
  // Relations (populated by API)
  ingredients?: Ingredient[]
  steps?: RecipeStep[]
  ratings?: RecipeRating[]
  averageRating?: number
  userRating?: number
  collections?: Collection[]
  dietaryTags?: DietaryTag[]
  nutrition?: Nutrition | null
  calories?: number | null // per serving; included on list responses
}

export type MealLabel = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface MealPlanEntry {
  id: string
  familyId: string
  date: string // YYYY-MM-DD
  mealLabel: MealLabel
  recipeId: string | null
  noteText: string | null
  calories: number | null // kcal for notes (AI estimate, editable); recipes use recipe.calories
  dayNote: string | null
  isRecurring: boolean
  recurrenceRule: string | null
  parentId: string | null
  createdBy: string | null
  // Relations
  recipe?: Pick<Recipe, 'id' | 'title' | 'pictureUrl' | 'prepTime' | 'cookTime' | 'calories'>
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

/** Supermarket walk order — keep in sync with AISLES in server/src/lib/classify.ts. */
export const AISLES = [
  'Fruit & Veg', 'Bakery', 'Meat & Fish', 'Deli & Dairy', 'Frozen',
  'Pasta, Rice & Grains', 'Tins & Jars', 'Sauces & Oils', 'Baking & Spices',
  'Breakfast & Spreads', 'Snacks & Sweets', 'Drinks', 'Health & Beauty',
  'Cleaning & Household', 'Baby & Pet', 'Other',
] as const

const AISLE_FOR_CATEGORY: Record<string, (typeof AISLES)[number]> = {
  Produce: 'Fruit & Veg', Dairy: 'Deli & Dairy', 'Meat & Seafood': 'Meat & Fish', Bakery: 'Bakery',
  Pantry: 'Tins & Jars', Beverages: 'Drinks', Frozen: 'Frozen', Snacks: 'Snacks & Sweets',
  'Health & Beauty': 'Health & Beauty', Household: 'Cleaning & Household',
}

/** Position in the shop: the item's own aisle, else the aisle implied by its category. */
export function aisleRank(item: { aisle?: string | null; category: string | null }): number {
  const aisle = item.aisle ?? AISLE_FOR_CATEGORY[item.category ?? ''] ?? 'Other'
  const i = (AISLES as readonly string[]).indexOf(aisle)
  return i === -1 ? AISLES.length : i
}

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
  shownRecipeIds?: string[]
  forceGenerate?: boolean
}

export interface LibrarySuggestion {
  id: string
  title: string
  pictureUrl: string | null
  prepTime: number | null
  cookTime: number | null
  servings: number
  effort: string | null
  protein: string | null
}

export type SuggestTurnResponse =
  | { type: 'question'; text: string }
  | { type: 'recipe'; importResult: RecipeImportResult }
  | { type: 'library'; recipes: LibrarySuggestion[] }

export const DIETARY_TAG_LABELS: Record<DietaryTag, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  gluten_free: 'Gluten Free',
  dairy_free: 'Dairy Free',
  nut_free: 'Nut Free',
}
