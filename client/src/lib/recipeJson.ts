import type { RecipeImportResult } from '../types'

const TAGS = ['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'nut_free'] as const

/** Prompt users paste into any AI (ChatGPT, Claude, Gemini…) so its answer imports into Mealio perfectly. */
export const AI_RECIPE_PROMPT = `I want to save a recipe in the Mealio app. Turn the recipe I give you (or the one we just discussed) into a single JSON object that follows this exact schema. Reply with ONLY the JSON inside one code block — no commentary.

{
  "title": string,
  "sourceUrl": string | null,
  "servings": number,
  "prepTime": number | null,
  "cookTime": number | null,
  "ingredients": [
    { "name": string, "quantity": number | null, "unit": string | null, "prepNote": string | null }
  ],
  "steps": [
    { "instruction": string }
  ],
  "dietaryTags": Array<"vegetarian" | "vegan" | "gluten_free" | "dairy_free" | "nut_free">,
  "nutrition": { "calories": number | null, "protein": number | null, "carbs": number | null, "fat": number | null } | null
}

Rules:
- prepTime and cookTime are whole minutes. servings is a whole number.
- quantity is a plain number (use 0.5, not "1/2"). Use null if there is no amount (e.g. "salt, to taste").
- unit is short and lowercase: g, kg, ml, l, tsp, tbsp, cup, or null. Use metric for weights (g/kg).
- name is only the ingredient (e.g. "onion"); put prep detail such as "finely diced" in prepNote.
- List EVERY ingredient. Each step is one clear instruction, in order, with no numbering.
- Only include dietaryTags that clearly apply. nutrition is per serving, or null if unknown.
- Output valid JSON only: double quotes, no trailing commas, no comments.

Recipe:
`

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Returns a RecipeImportResult if `text` is (or contains) a Mealio recipe JSON object, else null. */
export function parseRecipeJson(text: string): RecipeImportResult | null {
  const t = text.trim()
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)
  if (!candidate || !candidate.trim().startsWith('{')) return null
  let raw: any
  try { raw = JSON.parse(candidate) } catch { return null }
  if (!raw || typeof raw !== 'object' || !str(raw.title) || !Array.isArray(raw.ingredients)) return null

  const n = raw.nutrition
  return {
    title: str(raw.title)!,
    sourceUrl: str(raw.sourceUrl),
    servings: Math.max(1, Math.round(num(raw.servings) ?? 4)),
    prepTime: num(raw.prepTime),
    cookTime: num(raw.cookTime),
    ingredients: raw.ingredients
      .map((i: any) => typeof i === 'string'
        ? { name: i.trim(), quantity: null, unit: null, prepNote: null }
        : { name: str(i?.name) ?? '', quantity: num(i?.quantity), unit: str(i?.unit), prepNote: str(i?.prepNote) })
      .filter((i: { name: string }) => i.name),
    steps: (Array.isArray(raw.steps) ? raw.steps : [])
      .map((s: any) => ({ instruction: (typeof s === 'string' ? s : str(s?.instruction)) ?? '' }))
      .filter((s: { instruction: string }) => s.instruction),
    dietaryTags: (Array.isArray(raw.dietaryTags) ? raw.dietaryTags : []).filter((x: any) => TAGS.includes(x)),
    nutrition: n && typeof n === 'object'
      ? { calories: num(n.calories), protein: num(n.protein), carbs: num(n.carbs), fat: num(n.fat) }
      : null,
  } as RecipeImportResult
}
