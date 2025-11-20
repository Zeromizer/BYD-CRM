import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/react/',
  build: {
    outDir: path.resolve(__dirname, '../react'),
    emptyOutDir: true,
  }
})
