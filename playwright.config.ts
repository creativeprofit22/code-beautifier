import { defineConfig, devices } from "@playwright/test";
import path from "path";

const PORT = process.env.PORT || 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: path.join(__dirname, "e2e"),
  timeout: 30 * 1000,
  retries: process.env.CI ? 2 : 0,
  outputDir: "test-results/",
  reporter: process.env.CI ? "github" : "html",

  use: {
    baseURL,
    trace: "retry-with-trace",
    screenshot: "only-on-failure",
  },

  webServer: {
    command: "bun run dev",
    url: baseURL,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
