import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), visualizer({ open: false, filename: "dist/stats.html" })],
  // FIX-15: configurazione build per produzione
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-redux": ["@reduxjs/toolkit", "react-redux"],
          "vendor-motion": ["framer-motion"],
          "vendor-bootstrap": ["bootstrap"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: true,
    allowedHosts: [".ngrok-free.dev", ".ngrok-free.app", ".ngrok.io"],
    proxy: {
      // Il tablet parla solo con l'URL ngrok del frontend; Vite (sul Mac)
      // inoltra le chiamate API al backend locale → stesso-origine, niente CORS.
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        // Le route Spring sono tipo /admin/customers (NO prefisso /api),
        // quindi Vite deve togliere /api prima di girarle al backend:
        rewrite: p => p.replace(/^\/api/, ""),
      },
    },
  },
});
