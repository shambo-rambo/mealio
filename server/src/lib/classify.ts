// Jev-powered classifiers: short-text → label(s). Every function fails soft (null / empty)
// so a TypeSafe hiccup never blocks saving an item or a recipe.
import { askJev, askJevChunked, jevChoice, jevYes, type JevQuestion } from './jev.js'

// ── Shopping items ───────────────────────────────────────────────────────────

export const ITEM_CATEGORIES = [
  'Produce', 'Dairy', 'Meat & Seafood', 'Bakery', 'Pantry', 'Beverages',
  'Frozen', 'Snacks', 'Health & Beauty', 'Household', 'Other',
] as const

/** Roughly the order you walk a supermarket. Mirrored in client/src/types (AISLES). */
export const AISLES = [
  'Fruit & Veg', 'Bakery', 'Meat & Fish', 'Deli & Dairy', 'Frozen',
  'Pasta, Rice & Grains', 'Tins & Jars', 'Sauces & Oils', 'Baking & Spices',
  'Breakfast & Spreads', 'Snacks & Sweets', 'Drinks', 'Health & Beauty',
  'Cleaning & Household', 'Baby & Pet', 'Other',
] as const

export interface ItemClass { category: string; aisle: string }

/** One call, two questions: broad category and the supermarket aisle. */
export async function classifyNewItem(itemName: string, apiKey: string): Promise<ItemClass | null> {
  const answers = await askJev(apiKey, itemName, {
    category: {
      type: 'choice',
      instructions: 'Which grocery store category does this item belong to?',
      criteria: Object.fromEntries(ITEM_CATEGORIES.map((c) => [c, c])),
    },
    aisle: {
      type: 'choice',
      instructions: 'Which supermarket aisle would you find this item in?',
      criteria: Object.fromEntries(AISLES.map((a) => [a, a])),
    },
  }, 4000)
  const category = jevChoice(answers.category, ITEM_CATEGORIES)
  const aisle = jevChoice(answers.aisle, AISLES)
  if (!category && !aisle) return null
  return { category: category ?? 'Other', aisle: aisle ?? 'Other' }
}

// ── Recipes ──────────────────────────────────────────────────────────────────

export const ALLERGENS = ['nuts', 'dairy', 'gluten', 'egg', 'shellfish', 'fish', 'soy', 'sesame'] as const
export type Allergen = (typeof ALLERGENS)[number]

const ALLERGEN_DESC: Record<Allergen, string> = {
  nuts: 'peanuts or tree nuts (almond, cashew, walnut, pecan, pistachio, hazelnut), including nut butters, nut milks and marzipan',
  dairy: 'milk, cheese, butter, cream, yoghurt or other dairy',
  gluten: 'wheat, barley, rye, regular pasta, bread, flour, couscous or soy sauce made with wheat',
  egg: 'eggs or egg-based products such as mayonnaise',
  shellfish: 'shellfish: prawns, shrimp, crab, lobster, mussels, clams, oysters, squid',
  fish: 'fish, anchovies or fish sauce',
  soy: 'soy products: soy sauce, tofu, tempeh, edamame, miso, soy milk',
  sesame: 'sesame seeds, tahini or sesame oil',
}

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'side'] as const
export const EFFORTS = ['quick', 'medium', 'project'] as const
export const PROTEINS = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'seafood', 'eggs', 'plant', 'none'] as const
export const CUISINES = [
  'italian', 'asian', 'mexican', 'indian', 'mediterranean', 'middle_eastern',
  'british_irish', 'american', 'french', 'other',
] as const

export type DietaryTagId = 'vegetarian' | 'vegan' | 'gluten_free' | 'dairy_free' | 'nut_free'

export interface RecipeClass {
  dietaryTags: DietaryTagId[]
  allergens: Allergen[]
  mealType: (typeof MEAL_TYPES)[number] | null
  effort: (typeof EFFORTS)[number] | null
  protein: (typeof PROTEINS)[number] | null
  cuisine: (typeof CUISINES)[number] | null
  kidFriendly: boolean
}

function recipeState(title: string, ingredientNames: string[], prep?: number | null, cook?: number | null): string {
  const times = [prep != null ? `prep ${prep} min` : '', cook != null ? `cook ${cook} min` : ''].filter(Boolean).join(', ')
  return `Recipe: ${title}\n${times ? `Time: ${times}\n` : ''}Ingredients: ${ingredientNames.join(', ')}`
}

const choiceOf = (list: readonly string[], desc: Record<string, string> = {}) =>
  Object.fromEntries(list.map((v) => [v, desc[v] ?? v.replace(/_/g, ' ')]))

/** Dietary tags, allergens and meal-planning tags for a recipe — one Jev call, 15 questions. */
export async function classifyRecipe(
  title: string,
  ingredientNames: string[],
  apiKey: string,
  prepTime?: number | null,
  cookTime?: number | null,
): Promise<RecipeClass | null> {
  if (ingredientNames.length === 0) return null
  const questions: Record<string, JevQuestion> = {
    meat_or_fish: {
      type: 'noul',
      instructions: 'Does this recipe contain meat, poultry, fish, shellfish or gelatin?',
    },
    animal_product: {
      type: 'noul',
      instructions: 'Does this recipe contain any animal product at all: meat, fish, dairy, eggs or honey?',
    },
    kid_friendly: {
      type: 'noul',
      instructions: 'Would most children happily eat this? Mild flavours, familiar ingredients, not very spicy.',
    },
    meal_type: { type: 'choice', instructions: 'What kind of meal is this recipe?', criteria: choiceOf(MEAL_TYPES) },
    effort: {
      type: 'choice',
      instructions: 'How much effort is this recipe?',
      criteria: {
        quick: 'Under 30 minutes total and simple',
        medium: '30 to 60 minutes, or a few steps',
        project: 'Over an hour or involved, with many components or long cooking',
      },
    },
    protein: {
      type: 'choice',
      instructions: 'What is the main protein in this recipe?',
      criteria: {
        chicken: 'Chicken, turkey or other poultry',
        beef: 'Beef or veal, including mince',
        pork: 'Pork, bacon, ham or sausage',
        lamb: 'Lamb or mutton',
        fish: 'Fish',
        seafood: 'Shellfish or other seafood',
        eggs: 'Eggs are the main protein',
        plant: 'Beans, lentils, chickpeas, tofu, tempeh or other plant protein',
        none: 'No obvious main protein (pasta, vegetables, baking, sides)',
      },
    },
    cuisine: { type: 'choice', instructions: 'Which cuisine is this recipe closest to?', criteria: choiceOf(CUISINES) },
  }
  for (const a of ALLERGENS) {
    questions[`has_${a}`] = { type: 'noul', instructions: `Does this recipe contain ${ALLERGEN_DESC[a]}?` }
  }

  let answers
  try {
    answers = await askJev(apiKey, recipeState(title, ingredientNames, prepTime, cookTime), questions, 8000)
  } catch (err) {
    console.error('recipe classification failed', err)
    return null
  }

  // Lean safe: a 40% "contains it" is enough to flag an allergen.
  const allergens = ALLERGENS.filter((a) => jevYes(answers[`has_${a}`], 0.4))
  const hasMeat = jevYes(answers.meat_or_fish, 0.4)
  const hasAnimal = jevYes(answers.animal_product, 0.4)
  const dietaryTags: DietaryTagId[] = []
  if (!hasMeat && !allergens.includes('fish') && !allergens.includes('shellfish')) {
    dietaryTags.push('vegetarian')
    if (!hasAnimal && !allergens.includes('dairy') && !allergens.includes('egg')) dietaryTags.push('vegan')
  }
  if (!allergens.includes('gluten')) dietaryTags.push('gluten_free')
  if (!allergens.includes('dairy')) dietaryTags.push('dairy_free')
  if (!allergens.includes('nuts')) dietaryTags.push('nut_free')

  return {
    dietaryTags,
    allergens,
    mealType: jevChoice(answers.meal_type, MEAL_TYPES),
    effort: jevChoice(answers.effort, EFFORTS),
    protein: jevChoice(answers.protein, PROTEINS),
    cuisine: jevChoice(answers.cuisine, CUISINES),
    kidFriendly: jevYes(answers.kid_friendly, 0.5),
  }
}

// ── Daily Dozen food group per ingredient ────────────────────────────────────

export const FOOD_GROUPS = [
  'beans', 'berries', 'other_fruits', 'cruciferous', 'greens',
  'other_veg', 'flaxseeds', 'nuts_seeds', 'herbs_spices', 'whole_grains', 'none',
] as const
export type FoodGroup = (typeof FOOD_GROUPS)[number]

const FOOD_GROUP_DESC: Record<FoodGroup, string> = {
  beans: 'Beans, lentils, chickpeas, peas, tofu, tempeh, edamame, hummus',
  berries: 'Berries and berry-like fruit: strawberries, blueberries, raspberries, grapes, raisins, cranberries',
  other_fruits: 'Any fruit that is not a berry: apple, banana, citrus, mango, avocado, dried fruit',
  cruciferous: 'Broccoli, cauliflower, cabbage, kale, Brussels sprouts, bok choy, rocket, radish',
  greens: 'Leafy greens: spinach, lettuce, chard, salad leaves, herbs used as greens',
  other_veg: 'Any other vegetable: carrot, onion, tomato, capsicum, mushroom, courgette, sweet potato, squash',
  flaxseeds: 'Ground or whole flaxseed / linseed',
  nuts_seeds: 'Nuts and seeds: walnuts, almonds, cashews, chia, sunflower, pumpkin seeds, nut butters',
  herbs_spices: 'Herbs and spices: turmeric, cumin, paprika, ginger, garlic, cinnamon, basil, oregano, chilli',
  whole_grains: 'Whole grains only: oats, brown rice, quinoa, wholemeal bread or pasta, barley. Not white rice, white pasta or plain flour',
  none: 'Not one of these: meat, fish, dairy, eggs, oil, vinegar, sugar, stock, sauces, white rice/pasta/flour, water, salt',
}

/** Returns one group id (or 'none') per ingredient, same order. null where Jev failed. */
export async function classifyIngredientGroups(
  title: string,
  names: string[],
  apiKey: string,
): Promise<Array<FoodGroup | null>> {
  if (names.length === 0) return []
  const questions: Record<string, JevQuestion> = {}
  names.forEach((name, i) => {
    questions[`i${i}`] = {
      type: 'choice',
      instructions: `Which Daily Dozen food group does the ingredient "${name}" belong to?`,
      criteria: FOOD_GROUP_DESC,
    }
  })
  try {
    const answers = await askJevChunked(apiKey, `Ingredient in the recipe "${title}"`, questions, 25)
    return names.map((_, i) => jevChoice(answers[`i${i}`], FOOD_GROUPS))
  } catch (err) {
    console.error('food group classification failed', err)
    return names.map(() => null)
  }
}

// ── Import gate ──────────────────────────────────────────────────────────────

/**
 * Cheap pre-check before spending a Haiku call. Returns true when unsure or on any failure
 * (fail open) and false only when the text clearly is not a recipe.
 */
export async function looksLikeRecipe(text: string, apiKey: string | undefined): Promise<boolean> {
  if (!apiKey || text.trim().length < 20) return true
  try {
    const answers = await askJev(apiKey, text.slice(0, 4000), {
      is_recipe: {
        type: 'noul',
        instructions: 'Does this text contain a food recipe: a list of ingredients and/or cooking instructions?',
        criteria: {
          true: 'Describes how to make a dish, with ingredients or cooking steps',
          false: 'Not a recipe: unrelated article, error page, login wall, ad, or chatter',
        },
      },
    }, 4000)
    const a = answers.is_recipe
    return !(a?.type === 'noul' && a.noul < 0.1)
  } catch {
    return true
  }
}

// ── Library-first meal suggestions ───────────────────────────────────────────

export interface LibraryCandidate { id: string; summary: string }

/** Scores 0..1 for how well each saved recipe fits what the person asked for in the chat. */
export async function scoreLibraryRecipes(
  conversation: string,
  candidates: LibraryCandidate[],
  apiKey: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (candidates.length === 0) return out
  const questions: Record<string, JevQuestion> = {}
  candidates.forEach((c, i) => {
    questions[`r${i}`] = {
      type: 'noul',
      instructions: `Would this recipe be a good answer to what the person wants to cook? Recipe: ${c.summary}`,
      criteria: {
        true: 'Fits their time, mood, protein, effort and any ingredients they want to use up',
        false: 'Clashes with something they said, or is a poor match',
      },
    }
  })
  try {
    const answers = await askJevChunked(apiKey, conversation, questions, 25)
    candidates.forEach((c, i) => {
      const a = answers[`r${i}`]
      if (a?.type === 'noul') out.set(c.id, a.noul)
    })
  } catch (err) {
    console.error('library scoring failed', err)
  }
  return out
}
