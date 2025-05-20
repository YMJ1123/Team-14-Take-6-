import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        credentials: true
      }
    }
  },
})
