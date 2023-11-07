import mdx from '@mdx-js/rollup'
import react from '@vitejs/plugin-react-swc'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug],
      }),
    },
    react(),
  ],
  build: {
    outDir: '../dist',
  },
})
