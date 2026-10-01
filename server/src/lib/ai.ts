import Anthropic from '@anthropic-ai/sdk'
import type { RecipeImportResult, VideoData } from '../types.js'

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
Times are in minutes.

Ingredient extraction rules — follow these exactly:
- Extract EVERY ingredient listed. Do not skip, merge, or omit any ingredient.
- Copy quantities exactly as written in the source. Do not invent or alter numbers.
- Only convert weight units to metric (oz → g, lb → kg). Never convert cup/tbsp/tsp measurements for solid ingredients to grams — keep them as cups/tbsp/tsp.
- When both metric and imperial weights appear (e.g. "1 kg / 2 lb"), use the metric value.
- When a parenthetical gives a volume equivalent (e.g. "2 cups (500ml)"), use the cups form.
- For "can" ingredients, use the stated weight as the quantity and unit (e.g. "1 can (420g) creamed corn" → quantity: 420, unit: "g", name: "creamed corn").
- Preserve the full ingredient name exactly as written. Do not simplify or rename — "creamed corn" is not "corn kernels", "shredded cooked chicken" is not "chicken".
- When an ingredient has a prep instruction embedded (e.g. "cornstarch mixed with cold water"), keep it as ONE ingredient and put the prep detail in prepNote.
- "X or Y" alternatives belong in the name field, not split into separate ingredients.

Step rules:
- Apply the same unit conversions to step instructions as to ingredients: replace every imperial weight measurement in step text with its metric equivalent (e.g. "add 8 oz" → "add 227g", "1 lb" → "450g"). Keep volume measurements (cups, tbsp, tsp) unchanged.

Return ONLY the JSON object, no markdown, no explanation.`

function safeParseRecipe(text: string): RecipeImportResult {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(cleaned) as RecipeImportResult
  } catch {
    throw new Error('AI returned invalid JSON')
  }
}

const SOCIAL_RECIPE_SYSTEM = `You are a recipe extraction assistant. A user has shared a social media video (YouTube, Instagram, or TikTok) that may contain a recipe. You will be given the video's creator, title, description, and optionally a transcript.

Extract the recipe and return ONLY valid JSON matching this exact schema:
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
Times are in minutes.

Ingredient extraction rules — follow these exactly:
- Extract EVERY ingredient listed. Do not skip, merge, or omit any ingredient.
- Copy quantities exactly as written in the source. Do not invent or alter numbers.
- Only convert weight units to metric (oz → g, lb → kg). Never convert cup/tbsp/tsp measurements for solid ingredients to grams — keep them as cups/tbsp/tsp.
- When both metric and imperial weights appear (e.g. "1 kg / 2 lb"), use the metric value.
- When a parenthetical gives a volume equivalent (e.g. "2 cups (500ml)"), use the cups form.
- For "can" ingredients, use the stated weight as the quantity and unit (e.g. "1 can (420g) creamed corn" → quantity: 420, unit: "g", name: "creamed corn").
- Preserve the full ingredient name exactly as written. Do not simplify or rename — "creamed corn" is not "corn kernels", "shredded cooked chicken" is not "chicken".
- When an ingredient has a prep instruction embedded (e.g. "cornstarch mixed with cold water"), keep it as ONE ingredient and put the prep detail in prepNote.
- "X or Y" alternatives belong in the name field, not split into separate ingredients.

Step rules:
- Apply the same unit conversions to step instructions as to ingredients: replace every imperial weight measurement in step text with its metric equivalent (e.g. "add 8 oz" → "add 227g", "1 lb" → "450g"). Keep volume measurements (cups, tbsp, tsp) unchanged.

Return ONLY the JSON object, no markdown, no explanation.

IMPORTANT: If the video does not contain a recipe, return ONLY this exact JSON object:
{"error": "no_recipe_found"}`

export async function parseRecipeFromSocialVideo(data: VideoData, sourceUrl: string, apiKey: string): Promise<RecipeImportResult> {
  const client = new Anthropic({ apiKey })
  const parts: string[] = [
    `Creator: ${data.creator}`,
    `Title: ${data.title}`,
    `Description:\n${data.description}`,
  ]
  if (data.transcript) parts.push(`Transcript:\n${data.transcript}`)

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SOCIAL_RECIPE_SYSTEM,
    messages: [{ role: 'user', content: `Extract the recipe from this social media video:\n\n${parts.join('\n\n')}` }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const parsed = safeParseRecipe(text)

  if ('error' in parsed && (parsed as Record<string, unknown>).error === 'no_recipe_found') {
    throw new Error('no_recipe_found')
  }

  return { ...parsed, sourceUrl: parsed.sourceUrl ?? sourceUrl }
}

function extractThumbnailFromHtml(html: string): string | null {
  // 1. YouTube embed iframe — most reliable for video recipes
  const ytMatch = html.match(
    /(?:<iframe[^>]+src=["'])https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]+)/i,
  )
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`

  // 2. og:image — recipe site's own photo (attribute order varies)
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (ogMatch) return ogMatch[1]

  return null
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
}

type JsonLdShell = {
  title: string
  servings: number | null
  prepTime: number | null
  cookTime: number | null
  ingredientLines: string[]
  steps: Array<{ instruction: string }>
  nutrition: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null
}

// Extract structured metadata from JSON-LD, returning raw ingredient strings for AI parsing.
function extractJsonLdShell(html: string): JsonLdShell | null {
  const scriptMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of scriptMatches) {
    try {
      const data = JSON.parse(match[1].trim())
      const nodes: unknown[] = Array.isArray(data)
        ? data
        : data['@graph']
          ? data['@graph']
          : [data]
      for (const node of nodes) {
        const n = node as Record<string, unknown>
        if (n['@type'] !== 'Recipe') continue

        const toMins = (v: unknown): number | null => {
          if (!v || typeof v !== 'string') return null
          const m = v.match(/(?:(\d+)H)?(?:(\d+)M)?/i)
          if (!m) return null
          return (parseInt(m[1] ?? '0') * 60) + parseInt(m[2] ?? '0')
        }

        const ingredientLines = ((n['recipeIngredient'] as string[] | undefined) ?? [])
          .map((s) => decodeHtmlEntities(s))

        const rawSteps = (n['recipeInstructions'] as unknown[] | undefined) ?? []
        // Flatten HowToSection nodes (which nest steps inside itemListElement)
        const flatSteps: unknown[] = []
        for (const s of rawSteps) {
          if (s && typeof s === 'object' && (s as Record<string, unknown>)['@type'] === 'HowToSection') {
            const nested = (s as Record<string, unknown>)['itemListElement'] as unknown[] | undefined
            if (Array.isArray(nested)) flatSteps.push(...nested)
          } else {
            flatSteps.push(s)
          }
        }
        const steps = flatSteps
          .map((s) => {
            const text = typeof s === 'string' ? s : (s as Record<string, string>).text ?? ''
            return { instruction: decodeHtmlEntities(text) }
          })
          .filter((s) => s.instruction.trim() !== '')

        const nutrition = n['nutrition'] as Record<string, string> | undefined
        const parseNutrition = (v: string | undefined) => v ? parseFloat(v.replace(/[^\d.]/g, '')) : null

        const yieldRaw = n['recipeYield'] ?? n['yield']
        const servings = Array.isArray(yieldRaw)
          ? parseInt(String(yieldRaw[0]))
          : parseInt(String(yieldRaw ?? '0')) || null

        return {
          title: decodeHtmlEntities((n['name'] as string) ?? ''),
          servings,
          prepTime: toMins(n['prepTime']),
          cookTime: toMins(n['cookTime']),
          ingredientLines,
          steps,
          nutrition: nutrition ? {
            calories: parseNutrition(nutrition['calories']),
            protein: parseNutrition(nutrition['proteinContent']),
            carbs: parseNutrition(nutrition['carbohydrateContent']),
            fat: parseNutrition(nutrition['fatContent']),
          } : null,
        }
      }
    } catch {
      // malformed JSON-LD — fall through
    }
  }
  return null
}

// Parse ingredient lines into structured objects using AI.
async function parseIngredientLines(
  lines: string[],
  apiKey: string,
): Promise<Array<{ name: string; quantity: number | null; unit: string | null; prepNote: string | null }>> {
  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Parse these recipe ingredient lines into structured JSON. Return ONLY a JSON array, no markdown.

Rules:
- quantity: the numeric amount (number or null). For fractions like "½" use 0.5.
- unit: the measurement unit (g, kg, ml, l, cups, tbsp, tsp, etc.) or null if none. Convert oz→g, lb→kg. Never use "quantity" as a unit.
- name: the ingredient name only — no quantities, units, or prep instructions. Preserve "X or Y" alternatives in full.
- prepNote: any preparation instruction (minced, chopped, frenched, etc.) or clarifying note. Strip surrounding parentheses and leading commas.
- When both metric and imperial weights are given (e.g. "800g / 1.3lb"), use the metric value.
- For "N x Wg item" (e.g. "2 x 800g racks of lamb"), set quantity to the total weight (1600g) or keep as "2" with unit "x 800g" — prefer total weight in grams.

Ingredient lines:
${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Return a JSON array with one object per line in the same order.`,
    }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // Fall back to empty prep notes if parsing fails
    return lines.map((l) => ({ name: l, quantity: null, unit: null, prepNote: null }))
  }
}

type ParsedIngredient = { name: string; quantity: number | null; unit: string | null; prepNote: string | null }

// Returns true if any ingredient line was converted from imperial weights to metric.
function hasImperialToMetric(originalLines: string[], parsed: ParsedIngredient[]): boolean {
  return originalLines.some((line, i) => {
    const imperial = /\b\d[\d\s./]*\s*(oz|ounces?|lbs?|pounds?)\b/i.test(line)
    const metric = parsed[i]?.unit === 'g' || parsed[i]?.unit === 'kg'
    return imperial && metric
  })
}

// Rewrites step instructions so any imperial weight measurements are replaced with the
// metric equivalents that were used when parsing the ingredients. Only called on the
// fast (JSON-LD) path when conversions were detected.
async function rewriteStepsWithMetric(
  originalLines: string[],
  parsed: ParsedIngredient[],
  steps: Array<{ instruction: string }>,
  apiKey: string,
): Promise<Array<{ instruction: string }>> {
  // Build a concise before→after reference for the conversions that occurred
  const conversions: string[] = []
  originalLines.forEach((line, i) => {
    const p = parsed[i]
    if (!p) return
    const match = line.match(/(\d[\d\s./]*)\s*(oz|ounces?|lbs?|pounds?)/i)
    if (match && (p.unit === 'g' || p.unit === 'kg')) {
      const display = p.quantity != null ? `${p.quantity}${p.unit}` : p.unit ?? ''
      conversions.push(`"${match[0].trim()}" → "${display}"`)
    }
  })
  if (conversions.length === 0) return steps

  const client = new Anthropic({ apiKey })
  const stepsText = steps.map((s, i) => `${i + 1}. ${s.instruction}`).join('\n')

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `The following recipe steps contain imperial weight measurements. Apply these conversions throughout the step text:

${conversions.join('\n')}

Apply the conversions wherever those measurements appear (including variations like "8-ounce", "8 oz.", etc). Do not change volume measurements (cups, tbsp, tsp). Do not alter any other wording.

Steps:
${stepsText}

Return ONLY a JSON array of updated step objects: [{"instruction": "..."}, ...]`,
    }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return steps // fall back to original steps if parsing fails
  }
}

// Strip HTML down to plain text to reduce tokens when AI fallback is needed.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function parseRecipeFromUrl(url: string, apiKey: string): Promise<RecipeImportResult> {
  let html = ''
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FoodPrep/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })
    html = await res.text()
  } catch {
    throw new Error('Could not fetch the URL. Please check it is accessible.')
  }

  const thumbnailUrl = extractThumbnailFromHtml(html)

  // Fast path: JSON-LD found — use structured metadata + AI for ingredient lines only
  const shell = extractJsonLdShell(html)
  if (shell && shell.ingredientLines.length > 0) {
    const ingredients = await parseIngredientLines(shell.ingredientLines, apiKey)

    // If any imperial weights were converted to metric, rewrite step text to match
    const steps = hasImperialToMetric(shell.ingredientLines, ingredients) && shell.steps.length > 0
      ? await rewriteStepsWithMetric(shell.ingredientLines, ingredients, shell.steps, apiKey)
      : shell.steps

    return {
      title: shell.title,
      sourceUrl: url,
      thumbnailUrl,
      servings: shell.servings ?? 4,
      prepTime: shell.prepTime,
      cookTime: shell.cookTime,
      ingredients,
      steps,
      dietaryTags: [],
      nutrition: shell.nutrition,
    }
  }

  // Slow path: no JSON-LD — strip to plain text and send full recipe to AI
  const client = new Anthropic({ apiKey })
  const text = htmlToText(html).slice(0, 15_000)

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: RECIPE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Parse this recipe. Source URL: ${url}\n\n${text}`,
      },
    ],
  })

  const out = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const result = safeParseRecipe(out)
  return { ...result, sourceUrl: result.sourceUrl ?? url, thumbnailUrl }
}

export async function parseRecipeFromText(text: string, apiKey: string): Promise<RecipeImportResult> {
  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: RECIPE_SYSTEM,
    messages: [{ role: 'user', content: `Parse this recipe:\n\n${text}` }],
  })

  const out = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return safeParseRecipe(out)
}

export async function parseRecipeFromPhoto(base64Image: string, mediaType: string, apiKey: string): Promise<RecipeImportResult> {
  const client = new Anthropic({ apiKey })
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
  apiKey: string,
): Promise<{ calories: number | null; protein: number | null; carbs: number | null; fat: number | null }> {
  const client = new Anthropic({ apiKey })
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
  apiKey: string,
): Promise<Array<'vegetarian' | 'vegan' | 'gluten_free' | 'dairy_free' | 'nut_free'>> {
  const client = new Anthropic({ apiKey })
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

export const ITEM_CATEGORIES = [
  'Produce', 'Dairy', 'Meat & Seafood', 'Bakery', 'Pantry', 'Beverages',
  'Frozen', 'Snacks', 'Health & Beauty', 'Household', 'Other',
] as const

/** Quick classification with Jev (TypeSafe AI): a single Choice question over ITEM_CATEGORIES. */
export async function suggestItemCategory(itemName: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'jev-latest',
      state: itemName,
      questions: {
        category: {
          type: 'choice',
          instructions: 'Which grocery store category does this item belong to?',
          criteria: Object.fromEntries(ITEM_CATEGORIES.map((c) => [c, c])),
        },
      },
    }),
  })
  if (!res.ok) throw new Error(`TypeSafe ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json() as { answers?: { category?: { choice?: string } } }
  const choice = data.answers?.category?.choice
  return ITEM_CATEGORIES.find((c) => c === choice) ?? 'Other'
}

export async function chatSuggestMeal(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  recentMeals: string[],
  apiKey: string,
): Promise<{ type: 'question'; text: string } | { type: 'recipe'; importResult: RecipeImportResult }> {
  const client = new Anthropic({ apiKey })

  const recentContext = recentMeals.length > 0
    ? `\n\nThe user has had these meals recently — avoid suggesting them: ${recentMeals.join(', ')}.`
    : ''

  const system = `You are a friendly meal suggestion assistant. Your job is to ask the user a few short questions to understand what they'd like to cook, then suggest a specific recipe.

Rules:
- Ask ONE focused question at a time — never multiple questions in one message
- Keep questions conversational and brief
- Cover what matters: time available, number of people, mood or craving, any dietary needs, ingredients they want to use up
- Stop asking when you have enough context — usually 3 to 5 exchanges is plenty; don't over-question
- When you're ready, generate a complete detailed recipe${recentContext}

Response format — return ONLY valid JSON, no markdown, no commentary. Either:
{"type":"question","text":"your single question here"}

Or when you have enough context:
{"type":"recipe","title":"...","description":"One or two sentences describing the dish and what makes it appealing","sourceUrl":null,"servings":4,"prepTime":20,"cookTime":25,"ingredients":[{"name":"...","quantity":2,"unit":"tbsp","prepNote":null}],"steps":[{"instruction":"..."}],"dietaryTags":[],"thumbnailUrl":null,"nutrition":null}

If the user pushes back on a suggestion (e.g. "not that", "I don't want pasta", "too heavy"), treat it as new context — ask a follow-up question or suggest a different recipe. Never repeat a rejected suggestion.`

  // First turn — no messages yet, ask the opening question
  const turnMessages = messages.length === 0
    ? [{ role: 'user' as const, content: 'Help me decide what to cook.' }]
    : messages

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system,
    messages: turnMessages,
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''

  try {
    const parsed = JSON.parse(raw)
    if (parsed.type === 'question' && typeof parsed.text === 'string') {
      return { type: 'question', text: parsed.text }
    }
    if (parsed.type === 'recipe') {
      return { type: 'recipe', importResult: safeParseRecipe(raw.replace(/^.*?"type"\s*:\s*"recipe"\s*,/, '{')) }
    }
    // Fallback: if the AI skipped the wrapper and returned a recipe object directly
    if (parsed.title) {
      return { type: 'recipe', importResult: safeParseRecipe(raw) }
    }
  } catch { /* fall through */ }

  // If JSON parsing failed, treat it as a question
  return { type: 'question', text: raw.replace(/^["']|["']$/g, '') }
}
