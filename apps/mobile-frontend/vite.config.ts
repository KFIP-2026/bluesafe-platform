import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/wallet': 'http://localhost:3000',
      '/contracts': 'http://localhost:3000',
      '/v1': 'http://localhost:3100',
      '/health': 'http://localhost:3100',
    },
  },
})
