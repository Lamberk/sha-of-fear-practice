import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/ball/', // Change this to your GitHub Pages repository name
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})

