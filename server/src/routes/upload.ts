import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { saveFile, getFileUrl } from '../lib/storage.js'
import type { AppEnv } from '../types.js'

export const uploadRoutes = new Hono<AppEnv>()
uploadRoutes.use('*', authMiddleware)

uploadRoutes.post('/', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || typeof file === 'string') {
    return c.json({ error: { code: 'no_file', message: 'No file uploaded' } }, 400)
  }

  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return c.json({ error: { code: 'file_too_large', message: 'File must be under 5MB' } }, 400)
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: { code: 'invalid_type', message: 'Only image files are allowed' } }, 400)
  }

  const buffer = await file.arrayBuffer()
  const filename = await saveFile(c.env.R2, buffer, file.name)
  const url = getFileUrl(filename)

  return c.json({ url }, 201)
})
