import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost:3000/api' // Default fallback
  // Extract the origin (e.g., http://localhost:3000) from the full API base URL
  const targetUrl = new URL(apiBaseUrl).origin

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy requests starting with /api to the backend server
        '/api': {
          target: targetUrl,
          changeOrigin: true, // Needed for virtual hosted sites
          secure: false,      // Optional: Set to false if backend uses self-signed certs
          // Optional: Rewrite path if backend expects paths without /api prefix
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
