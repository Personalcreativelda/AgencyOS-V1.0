import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Offline mode (web + Android app): a service worker keeps the app shell on the device so it
// always opens (no internet, server restarting during a deploy…), and keeps the last API reads
// and images so screens show the latest saved data when the server can't be reached.
const NEVER_CACHE = /\/api\/v1\/(auth|social\/[a-z-]+\/(connect|callback|pending)|ads\/meta\/(connect|callback|pending)|google\/(connect|callback|pending)|ad-platforms\/[a-z]+\/(connect|callback|pending)|social\/whatsapp\/status)/

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // we decide when to switch versions (see src/lib/serviceWorker.ts)
      injectRegister: null,
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Public token pages and API calls are never answered with the app shell.
        navigateFallbackDenylist: [/^\/api\//, /^\/\.well-known\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Data: network first (fresh when online), saved copy when the server doesn't answer.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/v1/') && !NEVER_CACHE.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'agencyos-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Creatives, logos, avatars (any host).
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'agencyos-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'agencyos-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
