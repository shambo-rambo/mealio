import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

const useHttps = process.env.HTTPS === 'true'

export default defineConfig(async () => {
  const extraPlugins: PluginOption[] = []

  if (useHttps) {
    const { default: basicSsl } = await import('@vitejs/plugin-basic-ssl')
    extraPlugins.push(basicSsl() as PluginOption)
  }

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false, // served from public/manifest.json
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/v1\/(lists|recipes|meal-plan|collections|stores)/,
              handler: 'NetworkFirst' as const,
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
              },
            },
            {
              urlPattern: /^\/uploads\//,
              handler: 'CacheFirst' as const,
              options: {
                cacheName: 'uploads-cache',
                expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
      ...extraPlugins,
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': { target: 'http://localhost:8787', changeOrigin: true },
        '/uploads': { target: 'http://localhost:8787', changeOrigin: true },
        '/ws': { target: 'ws://localhost:8787', ws: true },
      },
    },
  }
})
