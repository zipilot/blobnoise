import { defineConfig } from "tsup";
import { copyFile } from "node:fs/promises";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "browser/index": "src/browser/index.ts",
    "export/index": "src/export/index.ts",
    "react/index": "src/react/index.tsx",
  },
  format: ["esm"],
  target: "es2022",
  dts: true,
  splitting: true,
  clean: true,
  sourcemap: true,
  external: ["three", "mediabunny", "react", "react/jsx-runtime", "zod"],
  async onSuccess() {
    await copyFile("../../LICENSE", "dist/LICENSE");
    await copyFile("../../NOTICE", "dist/NOTICE");
  },
});
