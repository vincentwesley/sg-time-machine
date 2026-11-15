import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname,
  base: "/sg-time-machine/",
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0, target: "es2023", chunkSizeWarningLimit: 1300 },
  server: { port: 5173 },
});
