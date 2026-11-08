import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";

// Copiar service worker para public durante build
const copyServiceWorker = () => {
  return {
    name: "copy-service-worker",
    generateBundle() {
      const sourcePath = resolve(__dirname, "src/firebase-messaging-sw.js");
      const targetPath = resolve(__dirname, "public/firebase-messaging-sw.js");

      if (existsSync(sourcePath)) {
        copyFileSync(sourcePath, targetPath);
        console.log("✅ Service worker copiado para public/");
      }
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), copyServiceWorker()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  publicDir: "public",
});
