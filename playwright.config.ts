import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const root = import.meta.dirname;
const data = join(root, "qa-output", "e2e-data");
const dist = join(root, "qa-output", "e2e-dist");
const vite = "npx vite --config site/vite.config.ts";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  outputDir: join(root, "test-results"),
  timeout: 45_000,
  workers: 1, // MapLibre on SwiftShader is CPU-heavy; parallel workers time out
  reporter: "list",
  use: { baseURL: "http://localhost:4173", browserName: "chromium", launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] } },
  webServer: {
    command: `node e2e/make-data.ts "${data}" && node scripts/build-site-data.ts && ${vite} build --outDir "${dist}" && ${vite} preview --outDir "${dist}" --port 4173 --strictPort`,
    env: { DATA_ROOT: data },
    url: "http://localhost:4173/sg-time-machine/",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
