import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // base tells Vite to serve all assets under /admin/ in both dev and build.
  // This is essential for the Nginx reverse proxy: all HTML, JS, CSS, and HMR
  // WebSocket requests from the admin app will be prefixed with /admin/, so
  // Nginx correctly routes them to this container instead of student-ui.
  base: '/admin/',
  server: {
    port: 5174,
    host: true,
    watch: {
      usePolling: true
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 5178
  }
})

