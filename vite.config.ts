import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

function injectPwaBuildAssets(): Plugin {
  let outputDirectory = "";
  let buildAssetUrls: string[] = [];
  const marker = "/* __PWA_BUILD_ASSETS__ */ []";
  return {
    name: "field-hours-pwa-precache",
    apply: "build",
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      buildAssetUrls = Object.keys(bundle)
        .filter((fileName) => !fileName.endsWith(".map") && fileName !== "sw.js")
        .map((fileName) => `/${fileName}`)
        .sort();
    },
    closeBundle() {
      const serviceWorkerPath = resolve(outputDirectory, "sw.js");
      const source = readFileSync(serviceWorkerPath, "utf8");
      if (!source.includes(marker) || buildAssetUrls.length === 0) {
        throw new Error("The production service worker could not receive its generated asset manifest.");
      }
      writeFileSync(serviceWorkerPath, source.replace(marker, JSON.stringify(buildAssetUrls)), "utf8");
    },
  };
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
  plugins: [react(), mode === "development" && componentTagger(), injectPwaBuildAssets()].filter(Boolean),
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
