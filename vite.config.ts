import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7001,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // The OAuth callback loads the SPA; token exchange still uses the backend.
        bypass(req) {
          if (req.method === 'GET' && req.url?.split('?')[0] === '/api/auth/callback/naver') {
            return '/index.html'
          }
        },
      },
    },
  },
})
