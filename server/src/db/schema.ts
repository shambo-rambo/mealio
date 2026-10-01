import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`)

const updatedAt = () =>
  text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`)

export const families = sqliteTable('families', {
  id: id(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull(),
  createdAt: createdAt(),
})

export const users = sqliteTable('users', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  avatar: text('avatar'),
  familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('owner'),
  createdAt: createdAt(),
})

export const stores = sqliteTable('stores', {
  id: id(),
  name: text('name').notNull(),
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
})

export const shoppingLists = sqliteTable('shopping_lists', {
  id: id(),
  name: text('name').notNull(),
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
})

export const shoppingItems = sqliteTable('shopping_items', {
  id: id(),
  listId: text('list_id')
    .notNull()
    .references(() => shoppingLists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: real('quantity'),
  packageSize: text('package_size'),
  category: text('category'),
  storeId: text('store_id').references(() => stores.id, { onDelete: 'set null' }),
  price: real('price'),
  imageUrl: text('image_url'),
  note: text('note'),
  checked: integer('checked', { mode: 'boolean' }).notNull().default(false),
  recipeSourceId: text('recipe_source_id'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
})

// One row per "reason this item is on the list": the usual buy, or a recipe that needs some.
// Lines are listed, never blindly summed; `selected` lets the user opt lines in or out.
export const itemLines = sqliteTable('item_lines', {
  id: id(),
  itemId: text('item_id')
    .notNull()
    .references(() => shoppingItems.id, { onDelete: 'cascade' }),
  source: text('source', { enum: ['manual', 'recipe'] }).notNull().default('manual'),
  sourceName: text('source_name'), // recipe title
  recipeId: text('recipe_id'),
  amount: text('amount').notNull().default(''), // display text, e.g. "1 kg", "2 carrots"
  quantity: real('quantity'),
  unit: text('unit'), // normalised: g, kg, ml, l ... or null for plain counts
  selected: integer('selected', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
})

export const recipes = sqliteTable('recipes', {
  id: id(),
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sourceUrl: text('source_url'),
  pictureUrl: text('picture_url'),
  prepTime: integer('prep_time'),
  cookTime: integer('cook_time'),
  servings: integer('servings').notNull().default(4),
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  lastPreparedAt: text('last_prepared_at'),
  preparedCount: integer('prepared_count').notNull().default(0),
  shareToken: text('share_token').unique(),
  createdAt: createdAt(),
})

export const ingredients = sqliteTable('ingredients', {
  id: id(),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: real('quantity'),
  unit: text('unit'),
  prepNote: text('prep_note'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const recipeSteps = sqliteTable('recipe_steps', {
  id: id(),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  instruction: text('instruction').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const recipeRatings = sqliteTable('recipe_ratings', {
  id: id(),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
})

export const collections = sqliteTable('collections', {
  id: id(),
  name: text('name').notNull(),
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
})

export const recipeCollections = sqliteTable('recipe_collections', {
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  collectionId: text('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
})

export const dietaryTags = sqliteTable('dietary_tags', {
  id: id(),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  tag: text('tag', {
    enum: ['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'nut_free'],
  }).notNull(),
})

export const nutrition = sqliteTable('nutrition', {
  id: id(),
  recipeId: text('recipe_id')
    .notNull()
    .unique()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  calories: real('calories'),
  protein: real('protein'),
  carbs: real('carbs'),
  fat: real('fat'),
  perServings: integer('per_servings').notNull().default(1),
})

export const mealPlan = sqliteTable('meal_plan', {
  id: id(),
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  mealLabel: text('meal_label', { enum: ['breakfast', 'lunch', 'dinner'] }).notNull(),
  recipeId: text('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
  noteText: text('note_text'),
  dayNote: text('day_note'),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
  recurrenceRule: text('recurrence_rule'),
  parentId: text('parent_id'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
})

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
})

export const itemHistory = sqliteTable('item_history', {
  id: id(),
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameLower: text('name_lower').notNull(),
  category: text('category'),
  storeId: text('store_id').references(() => stores.id, { onDelete: 'set null' }),
  usageCount: integer('usage_count').notNull().default(1),
  updatedAt: updatedAt(),
})

export const inviteCodes = sqliteTable('invite_codes', {
  id: id(),
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
})
