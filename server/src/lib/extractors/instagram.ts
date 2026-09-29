import type { VideoData } from '../../types.js'

// Uses the official Meta Graph API oEmbed endpoint.
// token = App Access Token: "{APP_ID}|{APP_SECRET}" — set as INSTAGRAM_TOKEN secret.
// See: https://developers.facebook.com/docs/instagram-platform/oembed/
export async function fetchInstagramData(url: string, token: string): Promise<VideoData> {
  const endpoint =
    `https://graph.facebook.com/v21.0/instagram_oembed` +
    `?url=${encodeURIComponent(url)}` +
    `&access_token=${encodeURIComponent(token)}` +
    `&fields=title,author_name`

  let res: Response
  try {
    res = await fetch(endpoint, { signal: AbortSignal.timeout(8_000) })
  } catch {
    throw new Error('post_unavailable')
  }

  const data = await res.json() as {
    title?: string
    author_name?: string
    error?: { message: string; type: string; code: number }
  }

  if (!res.ok || data.error) {
    console.error('[instagram] Meta oEmbed error', res.status, JSON.stringify(data.error ?? null))
    throw new Error('post_unavailable')
  }

  const caption = data.title?.trim() ?? ''
  if (!caption) throw new Error('post_unavailable')

  return {
    title: caption.slice(0, 120),
    description: caption,
    transcript: null,
    creator: data.author_name ?? '',
  }
}
