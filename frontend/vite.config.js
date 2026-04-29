import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: false, filename: "dist/stats.html" }),
  ],
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
    allowedHosts: ["leggings-celery-angled.ngrok-free.dev"],
  },
});
