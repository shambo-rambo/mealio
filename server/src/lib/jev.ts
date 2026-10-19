// Thin client for TypeSafe Jev (System One). One request = one `state` + many parallel questions.
// Docs: https://docs.typesafe.ai/api.md

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'

export type JevQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }

export type JevAnswer =
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'noul'; noul: number }

export type JevAnswers = Record<string, JevAnswer | undefined>

/** Runs the questions against `state`. Throws on HTTP errors or timeout (callers decide the fallback). */
export async function askJev(
  apiKey: string,
  state: string,
  questions: Record<string, JevQuestion>,
  timeoutMs = 6000,
): Promise<JevAnswers> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`TypeSafe ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json() as { answers?: JevAnswers }
  return data.answers ?? {}
}

export function jevChoice<T extends string>(a: JevAnswer | undefined, allowed: readonly T[]): T | null {
  if (a?.type !== 'choice') return null
  return allowed.find((v) => v === a.choice) ?? null
}

export function jevYes(a: JevAnswer | undefined, threshold = 0.5): boolean {
  return a?.type === 'noul' && a.noul >= threshold
}

/** Splits a long question set into parallel requests (keeps each call small). */
export async function askJevChunked(
  apiKey: string,
  state: string,
  questions: Record<string, JevQuestion>,
  chunkSize = 30,
  timeoutMs = 8000,
): Promise<JevAnswers> {
  const entries = Object.entries(questions)
  const chunks: Array<Record<string, JevQuestion>> = []
  for (let i = 0; i < entries.length; i += chunkSize) chunks.push(Object.fromEntries(entries.slice(i, i + chunkSize)))
  const parts = await Promise.all(chunks.map((q) => askJev(apiKey, state, q, timeoutMs)))
  return Object.assign({}, ...parts)
}
