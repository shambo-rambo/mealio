import axios from 'axios'

// In production VITE_API_URL = https://mealio-api.simon-hamblin.workers.dev
// In local dev it is undefined and the Vite proxy rewrites /api → localhost:8787
const apiBase = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1'

export const api = axios.create({
  baseURL: apiBase,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mealio_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear auth and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Auth form endpoints use 401 for "wrong password" - let those pages show the error themselves.
    const url: string = err.config?.url ?? ''
    const isAuthForm = url.startsWith('/auth/') && !url.startsWith('/auth/me')
    if (err.response?.status === 401 && !isAuthForm) {
      localStorage.removeItem('mealio_token')
      localStorage.removeItem('mealio_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message ?? err.message
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong'
}
