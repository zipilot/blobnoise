import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    license: { fileName: "THIRD-PARTY-LICENSES.md" },
  },
  resolve: {
    alias: [
      { find: "@alejo-valencia/blobnoise/browser", replacement: fileURLToPath(new URL("../../packages/blobnoise/src/browser/index.ts", import.meta.url)) },
      { find: "@alejo-valencia/blobnoise/export", replacement: fileURLToPath(new URL("../../packages/blobnoise/src/export/index.ts", import.meta.url)) },
      { find: "@alejo-valencia/blobnoise/react", replacement: fileURLToPath(new URL("../../packages/blobnoise/src/react/index.tsx", import.meta.url)) },
      { find: "@alejo-valencia/blobnoise", replacement: fileURLToPath(new URL("../../packages/blobnoise/src/index.ts", import.meta.url)) },
    ],
  },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
