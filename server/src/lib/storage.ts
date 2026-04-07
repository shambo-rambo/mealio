import { extname } from 'node:path'

export async function saveFile(r2: R2Bucket, buffer: ArrayBuffer, originalName: string): Promise<string> {
  const ext = extname(originalName) || '.bin'
  const filename = `${crypto.randomUUID()}${ext}`
  await r2.put(filename, buffer, {
    httpMetadata: { contentType: mimeFromExt(ext) },
  })
  return filename
}

export function getFileUrl(filename: string): string {
  const appUrl = process.env.APP_URL ?? 'http://localhost:8787'
  return `${appUrl}/uploads/${filename}`
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}
