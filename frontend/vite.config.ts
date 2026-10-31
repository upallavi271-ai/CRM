import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Frontend calls /api/...; Vite forwards it to the NestJS backend.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
