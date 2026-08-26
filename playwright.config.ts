import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4187";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "qa/reports/playwright-artifacts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "qa/reports/playwright", open: "never" }],
  ],
  use: {
    baseURL,
    geolocation: { latitude: 49.2144, longitude: -2.1313 },
    permissions: ["geolocation"],
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.E2E_EXTERNAL_SERVER ? undefined : {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4187",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
