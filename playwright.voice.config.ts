import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./voice-evals",
  fullyParallel: false,
  timeout: 150_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
  reporter: [["list"], ["html", { outputFolder: "voice-eval-report", open: "never" }]],
  webServer: {
    command: "npm run dev:voice-evals",
    url: "http://127.0.0.1:3101/e2e/voice-eval",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
