import { defineConfig, devices } from "@playwright/test";

const port = 5199;
const baseURL = `http://127.0.0.1:${port}`;

/**
 * Browser-level tests run against the `e2e.html` entry, which mounts the real
 * application with a deterministic in-page wallet and a network-mocked API.
 *
 * The dedicated entry keeps Playwright's harness out of the production bundle,
 * and the same-origin API base lets every request be fulfilled by `page.route`
 * without CORS or a running backend.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `${baseURL}/e2e.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...(process.env as Record<string, string>),
      VITE_API_BASE_URL: baseURL,
      VITE_PORT: String(port),
    },
  },
});
