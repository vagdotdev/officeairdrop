import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Unit tests for the pure layers (crypto, merkle, chunker, resume) run in a
// Node environment — Node 20+ provides Web Crypto (crypto.subtle), Blob, and
// File globally, which is everything these tests need.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
