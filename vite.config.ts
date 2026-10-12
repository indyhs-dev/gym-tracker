import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative paths so the same build works on GitHub Pages (sub-path) or Vercel (root).
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // globPatterns below already precaches everything in public/, icons included.
      includeManifestIcons: false,
      manifest: {
        name: 'Gym Log',
        short_name: 'Gym Log',
        description: 'Personal workout tracker',
        lang: 'en-GB',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A0A0A',
        theme_color: '#0A0A0A',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
