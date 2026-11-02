// The playground: a Vite + Vue page over the working tree. `orkami` and its entries resolve to
// ../src through aliases, so the page always shows the code as it is, never a build.
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const src = (p: string) => fileURLToPath(new URL(`../src/${p}`, import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Relative, so the built page works from any folder it is copied to
  base: './',
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^orkami\/vue$/, replacement: src('vue/index.ts') },
      { find: /^orkami\/css$/, replacement: src('css/index.ts') },
      { find: /^orkami\/three$/, replacement: src('three/index.ts') },
      { find: /^orkami\/orkami\.css$/, replacement: src('css/orkami.css') },
      { find: /^orkami$/, replacement: src('index.ts') },
    ],
  },
  server: { fs: { allow: ['..'] } },
  // three.js is its own chunk, loaded only by the WebGL views
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 700 },
})
