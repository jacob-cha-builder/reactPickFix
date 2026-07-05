import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env["PICKFIX_E2E_PORT"] ?? "4174";
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: e2eBaseUrl,
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      `npm run build --workspace packages/vite-plugin && npm run dev --workspace examples/vite-react -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: e2eBaseUrl,
  },
});
