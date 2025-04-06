import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'x-fetch': new URL('src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    environment: 'edge-runtime',
    coverage: {
      enabled: true,
      provider: 'istanbul',
      reporter: ['lcov', 'json', 'text'],
      include: ['src'],
    },
  },
})
