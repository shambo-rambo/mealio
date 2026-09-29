export type SocialPlatform = 'youtube' | 'instagram' | 'tiktok' | 'unsupported'

export function detectPlatform(url: string): SocialPlatform {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'unsupported'
  }
  const host = parsed.hostname.replace(/^www\./, '')
  if (host === 'youtube.com' || host === 'youtu.be') return 'youtube'
  if (host === 'instagram.com') return 'instagram'
  if (host === 'tiktok.com') return 'tiktok'
  return 'unsupported'
}
