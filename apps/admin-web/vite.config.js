import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: { port: 5175 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'DUSKNYT Admin', short_name: 'DN Admin', start_url: '/login', scope: '/', display: 'standalone',
        background_color: '#0b0812', theme_color: '#0b0812',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Only public, non-personalised GETs are cached for offline use.
        runtimeCaching: [{
          urlPattern: ({ url }) => /\/api\/v1\/(clubs|cities|home|offers)/.test(url.pathname),
          handler: 'NetworkFirst', options: { cacheName: 'dn-public-api', networkTimeoutSeconds: 5 },
        }],
      },
    }),
  ],
});
