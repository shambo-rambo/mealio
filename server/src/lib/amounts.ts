// Parse free-text amounts like "1 kg", "2 carrots", "500g" into a quantity + normalised unit.
// The client has an identical copy (client/src/lib/amounts.ts) that also sums lines for display.

const UNIT_ALIASES: Record<string, string> = {
  g: 'g', gram: 'g', grams: 'g', gm: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  bag: 'bag', bags: 'bag', pack: 'pack', packs: 'pack', packet: 'pack', packets: 'pack',
  tin: 'tin', tins: 'tin', can: 'tin', cans: 'tin', bunch: 'bunch', bunches: 'bunch',
  jar: 'jar', jars: 'jar', bottle: 'bottle', bottles: 'bottle', box: 'box', boxes: 'box',
  clove: 'clove', cloves: 'clove', slice: 'slice', slices: 'slice',
}

export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null
  const u = raw.toLowerCase().trim().replace(/\.$/, '')
  return UNIT_ALIASES[u] ?? (u || null)
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }

export interface ParsedAmount {
  amount: string
  quantity: number | null
  unit: string | null
}

export function parseAmount(text: string | null | undefined): ParsedAmount {
  const amount = (text ?? '').trim()
  if (!amount) return { amount: '', quantity: null, unit: null }
  const m = amount.match(/^(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|[½¼¾⅓⅔])\s*([a-zA-Z]+\.?)?/)
  if (!m) return { amount, quantity: null, unit: null }
  let quantity: number
  if (FRACTIONS[m[1]] != null) quantity = FRACTIONS[m[1]]
  else if (m[1].includes('/')) {
    const [a, b] = m[1].split('/').map((x) => parseFloat(x))
    quantity = b ? a / b : NaN
  } else quantity = parseFloat(m[1].replace(',', '.'))
  if (!Number.isFinite(quantity)) return { amount, quantity: null, unit: null }
  const word = m[2]?.toLowerCase().replace(/\.$/, '')
  // Only a recognised unit counts as a unit; "2 carrots" is a plain count
  const unit = word && UNIT_ALIASES[word] ? UNIT_ALIASES[word] : null
  return { amount, quantity, unit }
}
