// vite.config.ts/js (unchanged)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/lambdastudio/',   // ✅ keep this
  build: { outDir: 'dist' },
})
