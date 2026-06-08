// build: 2026-06-07
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
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
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,

        // Cachear solo assets estáticos del app shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        runtimeCaching: [
          // Assets estáticos: CacheFirst (no cambian entre deploys)
          {
            urlPattern: /\.(js|css|ico|png|svg|woff2)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 }
            }
          },

          // Rutas de API de auth: NUNCA cachear
          // El SW las deja pasar directo a la red siempre.
          // Si se cachean, un /auth/refresh puede devolver una
          // respuesta vieja y romper la rotación de tokens.
          {
            urlPattern: /\/auth\//,
            handler: 'NetworkOnly'
          },

          // Datos del dashboard: NetworkFirst con fallback a cache
          {
            urlPattern: /\/(prestamos\/resumen|pagos\/resumen)(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'dashboard-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 120 }
            }
          },

          // Configuración: StaleWhileRevalidate
          {
            urlPattern: /\/configuracion(\?.*)?$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'config-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 1800 }
            }
          },

          // Resto de rutas de API: NetworkOnly (nunca cachear datos sensibles)
          {
            urlPattern: /\/(clientes|prestamos|pagos|reportes|auditoria|usuarios|empleados|superadmin|rutas|caja)/,
            handler: 'NetworkOnly'
          }
        ],

        // Sirve index.html para cualquier ruta de navegación (SPA)
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^\/[^.]*$/],

        // Excluir rutas de API del navigateFallback
        // Si el SW recibe una petición fetch a /auth/refresh no debe
        // responder con index.html — debe dejarla pasar a la red
        navigateFallbackDenylist: [/^\/auth\//, /^\/api\//]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
})