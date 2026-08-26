import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
import { componentTagger } from "lovable-tagger";

function vendorChunk(id: string): string | undefined {
  const moduleId = id.replaceAll("\\", "/");
  if (
    moduleId.includes("/node_modules/react/")
    || moduleId.includes("/node_modules/react-dom/")
    || moduleId.includes("/node_modules/react-router/")
    || moduleId.includes("/node_modules/react-router-dom/")
  ) {
    return "react";
  }
  if (moduleId.includes("/node_modules/xlsx/")) return "xlsx";
  return undefined;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "https://field-hours-api.andres-san1404.workers.dev",
        changeOrigin: true,
        secure: true,
        headers: {
          origin: "https://field-hours.vercel.app",
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the long-lived vendors so an app deploy does not bust their cache.
        manualChunks: vendorChunk,
      },
    },
  },
}));
