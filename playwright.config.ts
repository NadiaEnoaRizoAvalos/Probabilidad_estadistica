import { defineConfig } from "@playwright/test";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "Probabilidad_estadistica";
const baseURL = `http://127.0.0.1:4173/${repository}/`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    launchOptions: { args: ["--disable-gpu", "--renderer-process-limit=2"] },
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
  },
});
