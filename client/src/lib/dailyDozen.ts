// Daily Dozen — based on Dr Michael Greger's nutritionfacts.org/daily-dozen/
// Classification is done client-side via keyword matching against ingredient names,
// recipe titles and free-text notes.

export type DailyDozenId =
  | 'beans' | 'berries' | 'other_fruits' | 'cruciferous'
  | 'greens' | 'other_veg' | 'flaxseeds' | 'nuts_seeds'
  | 'herbs_spices' | 'whole_grains'

export interface DailyDozenItem {
  id: DailyDozenId
  name: string
  shortName: string
  emoji: string
  description: string
  // Single-word keywords match as whole words (avoids "pea" → "peanut").
  // Multi-word phrases match as substrings.
  keywords: string[]
}

export const DAILY_DOZEN: DailyDozenItem[] = [
  {
    id: 'beans',
    name: 'Beans',
    shortName: 'Beans',
    emoji: '🫘',
    description: 'Beans, lentils, chickpeas, tofu, tempeh, edamame',
    keywords: [
      'bean', 'lentil', 'legume', 'chickpea', 'hummus', 'tofu', 'tempeh',
      'edamame', 'soy', 'soya', 'soymilk', 'dal', 'dhal', 'daal',
      'cannellini', 'fava', 'adzuki', 'mung', 'split pea', 'black bean',
      'kidney bean', 'navy bean', 'pinto bean', 'lima bean',
    ],
  },
  {
    id: 'berries',
    name: 'Berries',
    shortName: 'Berries',
    emoji: '🫐',
    description: 'All berries — fresh, frozen or dried',
    keywords: [
      'berry', 'berries', 'strawberry', 'blueberry', 'raspberry', 'blackberry',
      'cranberry', 'goji', 'acai', 'elderberry', 'mulberry', 'boysenberry',
      'grape', 'raisin', 'currant', 'gooseberry',
    ],
  },
  {
    id: 'other_fruits',
    name: 'Other Fruits',
    shortName: 'Fruits',
    emoji: '🍎',
    description: 'Any fruit other than berries',
    keywords: [
      'apple', 'banana', 'mango', 'orange', 'peach', 'pear', 'plum',
      'cherry', 'melon', 'watermelon', 'pineapple', 'kiwi', 'papaya',
      'apricot', 'fig', 'date', 'nectarine', 'pomegranate', 'lemon', 'lime',
      'grapefruit', 'mandarin', 'tangerine', 'passionfruit', 'guava',
      'lychee', 'persimmon', 'coconut', 'fruit salad', 'avocado',
    ],
  },
  {
    id: 'cruciferous',
    name: 'Cruciferous Veg',
    shortName: 'Crucif.',
    emoji: '🥦',
    description: 'Broccoli, cauliflower, cabbage, kale, Brussels sprouts, etc.',
    keywords: [
      'broccoli', 'cauliflower', 'cabbage', 'brussels sprout', 'kale',
      'bok choy', 'pak choi', 'arugula', 'rocket', 'watercress', 'radish',
      'turnip', 'collard', 'kohlrabi', 'horseradish', 'wasabi', 'rutabaga',
      'swede', 'broccolini', 'broccoflower',
    ],
  },
  {
    id: 'greens',
    name: 'Greens',
    shortName: 'Greens',
    emoji: '🥬',
    description: 'Spinach, lettuce, Swiss chard, mixed greens, etc.',
    keywords: [
      'spinach', 'lettuce', 'chard', 'silverbeet', 'mesclun', 'endive',
      'radicchio', 'chicory', 'microgreens', 'mixed greens', 'spring mix',
      'baby greens', 'salad leaves', 'cos', 'romaine', 'iceberg',
    ],
  },
  {
    id: 'other_veg',
    name: 'Other Vegetables',
    shortName: 'Veg',
    emoji: '🥕',
    description: 'All other vegetables',
    keywords: [
      'carrot', 'onion', 'tomato', 'capsicum', 'bell pepper', 'mushroom',
      'zucchini', 'courgette', 'eggplant', 'aubergine', 'corn', 'celery',
      'cucumber', 'beetroot', 'beet', 'sweet potato', 'potato', 'squash',
      'pumpkin', 'leek', 'asparagus', 'artichoke', 'fennel', 'okra',
      'parsnip', 'spring onion', 'scallion', 'chilli', 'jalapeño',
      'chive', 'shallot', 'butternut', 'sweet corn', 'snow pea',
      'snap pea', 'sugar snap',
    ],
  },
  {
    id: 'flaxseeds',
    name: 'Flaxseeds',
    shortName: 'Flax',
    emoji: '🌱',
    description: 'Ground flaxseeds / linseeds',
    keywords: ['flax', 'flaxseed', 'linseed', 'ground flax'],
  },
  {
    id: 'nuts_seeds',
    name: 'Nuts & Seeds',
    shortName: 'Nuts',
    emoji: '🥜',
    description: 'Nuts and seeds (excluding flaxseeds)',
    keywords: [
      'almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'brazil nut',
      'macadamia', 'hazelnut', 'peanut', 'sunflower seed', 'pumpkin seed',
      'pepita', 'sesame', 'tahini', 'chia', 'hemp seed', 'poppy seed',
      'pine nut', 'nut butter', 'almond butter', 'nut', 'seed mix',
    ],
  },
  {
    id: 'herbs_spices',
    name: 'Herbs & Spices',
    shortName: 'Spices',
    emoji: '🌿',
    description: 'Herbs and spices — especially turmeric and ginger',
    keywords: [
      'turmeric', 'ginger', 'cinnamon', 'cumin', 'coriander', 'cardamom',
      'clove', 'oregano', 'thyme', 'rosemary', 'basil', 'parsley', 'dill',
      'mint', 'sage', 'bay leaf', 'paprika', 'cayenne', 'star anise',
      'fennel seed', 'fenugreek', 'curry', 'masala', 'garlic',
    ],
  },
  {
    id: 'whole_grains',
    name: 'Whole Grains',
    shortName: 'Grains',
    emoji: '🌾',
    description: 'Oats, brown rice, quinoa, whole wheat, barley, etc.',
    keywords: [
      'oat', 'oatmeal', 'porridge', 'brown rice', 'quinoa', 'whole grain',
      'wholemeal', 'whole wheat', 'barley', 'buckwheat', 'millet', 'rye',
      'farro', 'spelt', 'teff', 'amaranth', 'muesli', 'granola', 'wholegrain',
      'multigrain', 'sourdough', 'brown bread', 'freekeh',
    ],
  },
]

// ── Classification ────────────────────────────────────────────────────────────

/**
 * Tokenise a string into words, handling common punctuation.
 * Returns both the individual tokens AND the full lowercased string for
 * multi-word phrase matching.
 */
function tokenise(text: string): { lower: string; words: string[] } {
  const lower = text.toLowerCase()
  const words = lower.split(/[\s,/()\-–]+/).filter(Boolean)
  return { lower, words }
}

/** Classify a single text value and return matching Daily Dozen category IDs. */
export function classifyText(text: string): Set<DailyDozenId> {
  const found = new Set<DailyDozenId>()
  if (!text.trim()) return found

  const { lower, words } = tokenise(text)

  for (const item of DAILY_DOZEN) {
    for (const kw of item.keywords) {
      let matched = false
      if (kw.includes(' ')) {
        // Multi-word phrase — substring match on the full lowercased string
        matched = lower.includes(kw)
      } else {
        // Single word — whole-word match (also accept common plural/possessive)
        matched = words.some((w) => w === kw || w === kw + 's' || w === kw + 'es' || w === kw + 'ed')
      }
      if (matched) {
        found.add(item.id)
        break // no need to keep checking this category's keywords
      }
    }
  }
  return found
}

export interface MealClassificationInput {
  recipeTitle?: string | null
  ingredientNames?: string[]
  noteText?: string | null
  dayNote?: string | null
}

/**
 * Classify a set of meal entries (one day's worth) and return the union of
 * Daily Dozen categories found across all meals and notes.
 */
export function classifyDay(meals: MealClassificationInput[]): Set<DailyDozenId> {
  const found = new Set<DailyDozenId>()

  const add = (s: Set<DailyDozenId>) => { for (const id of s) found.add(id) }

  for (const meal of meals) {
    if (meal.recipeTitle) add(classifyText(meal.recipeTitle))
    for (const name of meal.ingredientNames ?? []) add(classifyText(name))
    if (meal.noteText) add(classifyText(meal.noteText))
    if (meal.dayNote) add(classifyText(meal.dayNote))
  }

  return found
}
