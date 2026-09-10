import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev --workspace @blobnoise/studio -- --port 5173 --strictPort",
    url: "http://127.0.0.1:5173/harness.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
