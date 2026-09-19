import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin API calls in dev; in production Spring Boot serves the built app.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
