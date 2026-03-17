import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // FIX-15: configurazione build per produzione
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
