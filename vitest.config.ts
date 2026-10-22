import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // keep the subpath first — aliases match by prefix
      'x-fetch/observable': new URL('src/observable.ts', import.meta.url)
        .pathname,
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
      exclude: ['**/*.json'],
    },
  },
})
