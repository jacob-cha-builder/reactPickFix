import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev --workspace examples/vite-react -- --host 127.0.0.1 --port 5173 --strictPort",
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:5173",
  },
});
