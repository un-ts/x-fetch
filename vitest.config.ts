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
      'lib-boilerplate': './src/index.ts',
    },
  },
  test: {
    coverage: {
      reporter: ['lcov', 'json', 'text'],
    },
  },
})
