import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '', // Leerer String für relative Pfade
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: false, // Verhindert das Löschen der Backend-Dateien
  },
})
