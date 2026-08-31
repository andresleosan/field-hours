import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4187";
const crossBrowser = process.env.E2E_CROSS_BROWSER === "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: crossBrowser ? /legibility-audit\.spec\.ts/ : undefined,
  outputDir: "qa/reports/playwright-artifacts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
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
  projects: crossBrowser
    ? [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
      ]
    : [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
      ],
});
