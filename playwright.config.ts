import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:e2e",
    url: "http://127.0.0.1:3100/e2e/p2",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
