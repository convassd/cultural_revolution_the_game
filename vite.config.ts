import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Relative assets allow deployment under a static host subdirectory.
  base: './',
})
