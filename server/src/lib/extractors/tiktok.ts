import type { VideoData } from '../../types.js'

export async function fetchTikTokData(url: string): Promise<VideoData> {
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
  let res: Response
  try {
    res = await fetch(endpoint, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Mealio/1.0)' },
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new Error('post_unavailable')
  }

  // TikTok returns 400 for private/invalid URLs (not 404)
  if (res.status === 400 || res.status === 404 || !res.ok) {
    throw new Error('post_unavailable')
  }

  const data = await res.json() as { title?: string; author_name?: string }
  const caption = data.title?.trim() ?? ''
  if (!caption) throw new Error('post_unavailable')

  return {
    title: caption.slice(0, 120),
    description: caption,
    transcript: null,
    creator: data.author_name ?? '',
  }
}
