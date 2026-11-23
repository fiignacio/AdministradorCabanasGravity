import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'icons.svg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000 // 5 MB
      },
      manifest: {
        name: 'Cabañas Manuara - Panel Administrador',
        short_name: 'Manuara Admin',
        description: 'Gestor de Reservas de Cabañas, Vehículos y Tours',
        theme_color: '#8C5A32',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  server: {
    port: 5174
  }
});
