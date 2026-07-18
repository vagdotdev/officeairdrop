import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Beam client. The dev server proxies nothing — the browser talks to the
// signaling server directly via VITE_SIGNALING_URL.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Load package-local .env* (e.g. .env.production) so Vercel builds pick up
  // VITE_SIGNALING_URL without depending on dashboard env wiring.
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true, // expose on LAN so teammates can open Drop
  },
});
