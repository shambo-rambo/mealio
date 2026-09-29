import { YoutubeTranscript } from 'youtube-transcript'
import type { VideoData } from '../../types.js'

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1).split('?')[0] || null
    if (parsed.searchParams.has('v')) return parsed.searchParams.get('v')
    const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/)
    if (shortsMatch) return shortsMatch[1]
  } catch {}
  return null
}

export async function fetchYouTubeData(url: string, apiKey: string): Promise<VideoData> {
  const videoId = extractVideoId(url)
  if (!videoId) throw new Error('post_unavailable')

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${encodeURIComponent(apiKey)}`
  let meta: { title: string; description: string; channelTitle: string; thumbnails: { maxres?: { url: string }; high?: { url: string }; medium?: { url: string } } }
  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) throw new Error('api_error')
    const json = await res.json() as {
      items?: Array<{ snippet: { title: string; description: string; channelTitle: string; thumbnails: { maxres?: { url: string }; high?: { url: string }; medium?: { url: string } } } }>
    }
    const item = json.items?.[0]
    if (!item) throw new Error('post_unavailable')
    meta = item.snippet
  } catch (err) {
    if (err instanceof Error && err.message === 'post_unavailable') throw err
    throw new Error('post_unavailable')
  }

  let transcriptText: string | null = null
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId)
    transcriptText = segments.map((s) => s.text).join(' ').slice(0, 6_000)
  } catch {
    // Captions disabled or unavailable — not a hard failure
    transcriptText = null
  }

  const thumbnailUrl =
    meta.thumbnails.maxres?.url ??
    meta.thumbnails.high?.url ??
    meta.thumbnails.medium?.url ??
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

  return {
    title: meta.title,
    description: meta.description.slice(0, 2_000),
    transcript: transcriptText,
    creator: meta.channelTitle,
    thumbnailUrl,
  }
}
