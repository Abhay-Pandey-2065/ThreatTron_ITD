import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})

// All public env vars must start with VITE_
// e.g. VITE_API_URL=https://your-deployed-backend.com