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
      'fetch-api': './src/index.ts',
    },
  },
  test: {
    coverage: {
      provider: 'istanbul',
      reporter: ['lcov', 'json', 'text'],
    },
  },
})
