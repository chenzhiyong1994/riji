const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "qa/test-results",
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    viewport: { width: 412, height: 850 },
    baseURL: "http://127.0.0.1:8766",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/serve.cjs",
    url: "http://127.0.0.1:8766",
    reuseExistingServer: false,
  },
});
