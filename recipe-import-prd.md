# Feature PRD: Recipe Import from Social Video

**Version:** 1.0  
**Stack:** Hono · Drizzle ORM · SQLite · Anthropic Claude API

---

## Overview

A single feature that accepts a YouTube, Instagram, or TikTok URL and returns a structured recipe object by extracting the post caption/transcript and passing it to Claude.

---

## User Story

As a user, I paste or share a social video URL into the app and receive a structured recipe (name, ingredients, steps, times, servings) that is saved to my account.

---

## Scope

**In scope:**
- URL input (paste or Web Share Target)
- Platform detection (YouTube / Instagram / TikTok)
- Caption/transcript extraction per platform
- Claude parsing caption into structured recipe
- Persisting recipe to SQLite via Drizzle
- Returning structured recipe JSON to the client
- Basic error states (no recipe found, private account, unsupported URL)

**Out of scope:**
- Video download or frame extraction
- On-screen text (vision) extraction
- Recipe editing
- Recipe search or browsing
- Auth (assume `userId` is available from JWT middleware upstream)

---

## API

### `POST /api/recipes/import`

**Request**
```json
{ "url": "https://www.instagram.com/p/DVuzDfxk1lE/" }
```

**Response (success)**
```json
{
  "id": 1,
  "name": "Creamy Tomato Pasta",
  "sourceUrl": "https://www.instagram.com/p/DVuzDfxk1lE/",
  "creator": "@example",
  "servings": "4",
  "prepTime": "10 mins",
  "cookTime": "20 mins",
  "ingredients": ["400g pasta", "1 can crushed tomatoes", "..."],
  "steps": ["Boil salted water.", "..."],
  "notes": "Add chilli flakes for heat.",
  "createdAt": "2026-04-08T00:00:00Z"
}
```

**Response (no recipe found)**
```json
{ "error": "no_recipe_found", "message": "No recipe detected in this post." }
```

**Response (unsupported platform)**
```json
{ "error": "unsupported_url", "message": "Only YouTube, Instagram, and TikTok URLs are supported." }
```

---

## Platform Extraction

### Platform Detection
```typescript
type Platform = 'youtube' | 'instagram' | 'tiktok' | 'unsupported'

function detectPlatform(url: string): Platform {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('tiktok.com')) return 'tiktok'
  return 'unsupported'
}
```

### YouTube
- Extract video ID from URL
- Fetch title + description via **YouTube Data API v3** (requires `YOUTUBE_API_KEY` env var)
- Fetch transcript via **`youtube-transcript`** npm package (no key required)
- Prefer transcript over description if both present — transcripts carry spoken recipe steps

```typescript
import { YoutubeTranscript } from 'youtube-transcript'

async function fetchYouTubeData(url: string) {
  const videoId = extractYouTubeId(url)
  const [meta, transcript] = await Promise.allSettled([
    fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`)
      .then(r => r.json()),
    YoutubeTranscript.fetchTranscript(videoId)
  ])
  return {
    title: meta.value?.items?.[0]?.snippet?.title ?? '',
    description: meta.value?.items?.[0]?.snippet?.description ?? '',
    transcript: transcript.value?.map(t => t.text).join(' ') ?? '',
    creator: meta.value?.items?.[0]?.snippet?.channelTitle ?? '',
  }
}
```

### Instagram
- Fetch caption via public oEmbed endpoint — no auth required for public posts
- `title` field in the oEmbed response contains the caption

```typescript
async function fetchInstagramData(url: string) {
  const res = await fetch(
    `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`
  )
  const data = await res.json()
  return {
    title: '',
    description: data.title ?? '',
    transcript: '',
    creator: data.author_name ?? '',
  }
}
```

### TikTok
- Fetch caption via TikTok oEmbed endpoint — no auth required for public posts
- `title` field contains the caption/description

```typescript
async function fetchTikTokData(url: string) {
  const res = await fetch(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
  )
  const data = await res.json()
  return {
    title: '',
    description: data.title ?? '',
    transcript: '',
    creator: data.author_name ?? '',
  }
}
```

---

## Claude Extraction

Pass all available text to Claude and request structured JSON output.

**Model:** `claude-sonnet-4-6`  
**Max tokens:** 2000

**Prompt:**
```
You are a recipe extraction assistant. Given text from a social media cooking post, extract the recipe and return ONLY a JSON object — no preamble, no markdown.

If no recipe is present, return: {"error": "no_recipe_found"}

JSON shape:
{
  "name": string,
  "servings": string,        // e.g. "4 servings"
  "prepTime": string,        // e.g. "15 mins" — null if unknown
  "cookTime": string,        // e.g. "30 mins" — null if unknown
  "ingredients": string[],   // one item per element, include quantities
  "steps": string[],         // one action per step, plain sentences
  "notes": string            // tips, substitutions, variations — null if none
}

Post text:
---
Title: {title}
Creator: {creator}
Caption/Description: {description}
Transcript: {transcript}
---
```

---

## Database Schema (Drizzle + SQLite)

```typescript
// schema.ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

export const recipes = sqliteTable('recipes', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  userId:      integer('user_id').notNull(),
  name:        text('name').notNull(),
  sourceUrl:   text('source_url'),
  creator:     text('creator'),
  servings:    text('servings'),
  prepTime:    text('prep_time'),
  cookTime:    text('cook_time'),
  notes:       text('notes'),
  createdAt:   integer('created_at', { mode: 'timestamp' }).defaultNow(),
})

export const ingredients = sqliteTable('ingredients', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  recipeId:   integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  text:       text('text').notNull(),
  orderIndex: integer('order_index').notNull(),
})

export const steps = sqliteTable('steps', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  recipeId:   integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  text:       text('text').notNull(),
  orderIndex: integer('order_index').notNull(),
})
```

---

## Hono Route

```typescript
// routes/import.ts
app.post('/api/recipes/import', async (c) => {
  const { url } = await c.req.json()
  const userId = c.get('userId') // from JWT middleware

  const platform = detectPlatform(url)
  if (platform === 'unsupported') {
    return c.json({ error: 'unsupported_url', message: 'Only YouTube, Instagram, and TikTok URLs are supported.' }, 400)
  }

  const videoData = await fetchVideoData(url, platform)
  const recipe = await extractRecipeWithClaude(videoData)

  if ('error' in recipe) {
    return c.json({ error: 'no_recipe_found', message: 'No recipe detected in this post.' }, 422)
  }

  const saved = await saveRecipe(db, userId, url, recipe)
  return c.json(saved, 201)
})
```

---

## Environment Variables

```
ANTHROPIC_API_KEY=
YOUTUBE_API_KEY=
```

Instagram and TikTok require no API keys for public posts.

---

## Error Handling

| Scenario | HTTP | Error code |
|---|---|---|
| Unsupported platform | 400 | `unsupported_url` |
| Private/unavailable post | 422 | `post_unavailable` |
| No recipe in post | 422 | `no_recipe_found` |
| Claude API failure | 502 | `extraction_failed` |
| YouTube API quota exceeded | 502 | `extraction_failed` |

---

## Dependencies

```
npm install hono drizzle-orm better-sqlite3 @anthropic-ai/sdk youtube-transcript
npm install -D drizzle-kit @types/better-sqlite3
```

---

## File Structure

```
src/
  routes/
    import.ts         ← POST /api/recipes/import
  lib/
    extractors/
      youtube.ts      ← YouTube Data API + transcript
      instagram.ts    ← oEmbed
      tiktok.ts       ← oEmbed
    claude.ts         ← Claude extraction prompt + parsing
    detect.ts         ← platform detection from URL
  db/
    schema.ts         ← Drizzle schema
    index.ts          ← db instance
```
