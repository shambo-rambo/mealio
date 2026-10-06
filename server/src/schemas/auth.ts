import { z } from 'zod'

// bcrypt only uses the first 72 bytes, so cap there rather than silently truncating.
const password = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters')

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(100),
  email: z.string().trim().email('Enter a valid email address'),
  password,
})

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

export const forgotSchema = z.object({ email: z.string().trim().email('Enter a valid email address') })
export const resetSchema = z.object({ token: z.string().min(10), password })
export const googleSchema = z.object({ credential: z.string().min(20) })
export const changePasswordSchema = z.object({ currentPassword: z.string().optional(), newPassword: password })
