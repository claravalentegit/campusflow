import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: mode === 'single'
    ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, rollupOptions: { output: { inlineDynamicImports: true } }, chunkSizeWarningLimit: 2000 }
    : {
    // Main chunk = React, router, date-fns, app shell and dashboard (~165 kB gzip); pages are split per route.
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
}))
