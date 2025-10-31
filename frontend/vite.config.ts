import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // For user site: base: '/'
  base: '/lambdastudio/',
  build: { outDir: 'dist' }
})
