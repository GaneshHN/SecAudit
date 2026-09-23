import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        // All API routes → Node.js backend on port 5000
        // Note: /api/v1 routes are also handled by the Node.js backend.
        // If you add a separate FastAPI/Python backend, restore the /api/v1 → port 8000 rule.
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})

