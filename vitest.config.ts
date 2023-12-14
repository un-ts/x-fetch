import autoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    autoImport({
      imports: 'vitest',
    }),
  ],
  resolve: {
    alias: {
      'x-fetch': new URL('src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'edge-runtime',
    coverage: {
      provider: 'istanbul',
      reporter: ['lcov', 'json', 'text'],
      include: ['src'],
    },
  },
})
