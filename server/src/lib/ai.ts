import Anthropic from '@anthropic-ai/sdk'
import type { RecipeImportResult } from '../types.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-20250514'

const RECIPE_SYSTEM = `You are a recipe parsing assistant. Extract structured recipe data and return ONLY valid JSON matching this exact schema:
{
  "title": string,
  "sourceUrl": string | null,
  "servings": number,
  "prepTime": number | null,
  "cookTime": number | null,
  "ingredients": Array<{ "name": string, "quantity": number | null, "unit": string | null, "prepNote": string | null }>,
  "steps": Array<{ "instruction": string }>,
  "dietaryTags": Array<"vegetarian" | "vegan" | "gluten_free" | "dairy_free" | "nut_free">,
  "nutrition": { "calories": number | null, "protein": number | null, "carbs": number | null, "fat": number | null } | null
}
Times are in minutes. Return ONLY the JSON object, no markdown, no explanation.`

function safeParseRecipe(text: string): RecipeImportResult {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(cleaned) as RecipeImportResult
  } catch {
    throw new Error('AI returned invalid JSON')
  }
}

export async function parseRecipeFromUrl(url: string): Promise<RecipeImportResult> {
  let html = ''
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Mealio/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })
    html = await res.text()
    // Truncate to ~20k chars to stay within token limits
    html = html.slice(0, 20_000)
  } catch {
    throw new Error('Could not fetch the URL. Please check it is accessible.')
  }

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: RECIPE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Parse this recipe from the following webpage HTML. Source URL: ${url}\n\nHTML:\n${html}`,
      },
    ],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const result = safeParseRecipe(text)
  return { ...result, sourceUrl: result.sourceUrl ?? url }
}

export async function parseRecipeFromText(text: string): Promise<RecipeImportResult> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: RECIPE_SYSTEM,
    messages: [{ role: 'user', content: `Parse this recipe:\n\n${text}` }],
  })

  const out = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return safeParseRecipe(out)
}

export async function parseRecipeFromPhoto(base64Image: string, mediaType: string): Promise<RecipeImportResult> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: RECIPE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: base64Image },
          },
          { type: 'text', text: 'Parse the recipe shown in this image.' },
        ],
      },
    ],
  })

  const out = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return safeParseRecipe(out)
}

export async function generateNutrition(
  ingredients: Array<{ name: string; quantity: number | null; unit: string | null }>,
  servings: number,
): Promise<{ calories: number | null; protein: number | null; carbs: number | null; fat: number | null }> {
  const ingredientList = ingredients
    .map((i) => `${i.quantity ?? ''} ${i.unit ?? ''} ${i.name}`.trim())
    .join('\n')

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `Estimate the nutrition per serving for a recipe with ${servings} servings containing these ingredients:\n${ingredientList}\n\nReturn ONLY JSON: {"calories": number|null, "protein": number|null, "carbs": number|null, "fat": number|null}`,
      },
    ],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  try {
    return JSON.parse(text.trim())
  } catch {
    return { calories: null, protein: null, carbs: null, fat: null }
  }
}

export async function generateDietaryTags(
  ingredients: Array<{ name: string }>,
): Promise<Array<'vegetarian' | 'vegan' | 'gluten_free' | 'dairy_free' | 'nut_free'>> {
  const list = ingredients.map((i) => i.name).join(', ')
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 128,
    messages: [
      {
        role: 'user',
        content: `Given these ingredients: ${list}\n\nWhich of these dietary tags apply? Return ONLY a JSON array containing applicable tags from: ["vegetarian","vegan","gluten_free","dairy_free","nut_free"]`,
      },
    ],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  try {
    return JSON.parse(text.trim())
  } catch {
    return []
  }
}

export async function suggestItemCategory(itemName: string): Promise<string> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 32,
    messages: [
      {
        role: 'user',
        content: `What grocery store category does "${itemName}" belong to? Return ONLY the category name from: Produce, Dairy, Meat & Seafood, Bakery, Pantry, Beverages, Frozen, Snacks, Health & Beauty, Household, Other`,
      },
    ],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : 'Other'
  return text
}
