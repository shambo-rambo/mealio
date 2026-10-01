// Parse free-text amounts like "1 kg", "2 carrots", "500g" into a quantity + normalised unit.
// Copy of server/src/lib/amounts.ts (keep the parsing in sync), plus the line summary used for display.

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

/** How a recipe's ingredient reads as a line: "600 g", "2 carrots", or "" when no amount is given. */
export function describeNeed(name: string, quantity: number | null, unit: string | null): string {
  if (quantity == null) return ''
  const q = String(Math.round(quantity * 100) / 100)
  return unit ? `${q} ${unit}` : `${q} ${name}`.trim()
}

// ── Summarising an item's ticked lines ("1 kg + 1 carrot") ──────────────────

import type { ItemLine } from '../types'

const MASS: Record<string, number> = { g: 1, kg: 1000 }
const VOLUME: Record<string, number> = { ml: 1, l: 1000 }

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/**
 * Combine the selected lines into one short string. Only lines that can really be
 * added are summed (same unit, or g with kg, ml with l, or plain counts); anything
 * else is listed side by side, so "1 kg" and "1 carrot" stay separate.
 */
export function summariseLines(lines: ItemLine[]): string {
  const parts: string[] = []
  const buckets = new Map<string, { total: number; kind: 'mass' | 'volume' | 'unit' | 'count'; unit: string | null; first: string }>()

  for (const l of lines.filter((x) => x.selected)) {
    if (l.quantity == null) {
      if (l.amount) parts.push(l.amount)
      continue
    }
    const u = l.unit
    let key: string, kind: 'mass' | 'volume' | 'unit' | 'count', total = l.quantity
    if (u && MASS[u]) { key = 'mass'; kind = 'mass'; total *= MASS[u] }
    else if (u && VOLUME[u]) { key = 'volume'; kind = 'volume'; total *= VOLUME[u] }
    else if (u) { key = `unit:${u}`; kind = 'unit' }
    else { key = 'count'; kind = 'count' }
    const b = buckets.get(key)
    if (b) b.total += total
    else buckets.set(key, { total, kind, unit: u, first: l.amount })
  }

  for (const b of buckets.values()) {
    if (b.kind === 'mass') parts.push(b.total >= 1000 ? `${fmt(b.total / 1000)} kg` : `${fmt(b.total)} g`)
    else if (b.kind === 'volume') parts.push(b.total >= 1000 ? `${fmt(b.total / 1000)} l` : `${fmt(b.total)} ml`)
    else if (b.kind === 'unit') parts.push(`${fmt(b.total)} ${b.unit}`)
    else parts.push(b.first.replace(/^[\d.,/\s½¼¾⅓⅔]+/, `${fmt(b.total)} `).trim())
  }
  return parts.join(' + ')
}
