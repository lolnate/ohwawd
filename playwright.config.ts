import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT || "3000";

export default defineConfig({
  testDir: "./tests/ui",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: `npm run dev -- --port ${port}`, url: `http://localhost:${port}/api/health/live`, reuseExistingServer: true, timeout: 120_000 },
});
