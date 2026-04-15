import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'offline.html'],
      manifest: {
        id: '/',
        name: 'Presta Tech',
        short_name: 'PrestaTech',
        description: 'Sistema de gestión de préstamos',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\.(js|css|ico|png|svg|woff2|html)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 }
            }
          },
          {
            urlPattern: /\/(prestamos\/resumen|pagos\/resumen)(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'dashboard-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 120 }
            }
          },
          {
            urlPattern: /\/configuracion(\?.*)?$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'config-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 1800 }
            }
          },
          {
            urlPattern: /\/(clientes|prestamos|pagos|auth|reportes|auditoria|usuarios|empleados|superadmin|rutas|caja)(?!\/resumen)/,
            handler: 'NetworkOnly'
          }
        ],
        navigateFallback: 'offline.html'
      },
      devOptions: {
        enabled: false
      }
    })
  ],
})
