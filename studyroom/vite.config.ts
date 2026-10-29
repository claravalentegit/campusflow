import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: { proxy: { '/api': 'http://localhost:8788' } },
  preview: { proxy: { '/api': 'http://localhost:8788' } },
  test: { environment: 'node', include: ['shared/**/*.test.ts', 'server/**/*.test.ts'] },
})
