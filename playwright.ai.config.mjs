import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ai',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results/ai',
  use: {
    baseURL: 'http://127.0.0.1:3107',
    headless: true,
    launchOptions: process.env.AI_TEST_BROWSER ? { executablePath: process.env.AI_TEST_BROWSER } : {},
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3107',
    url: 'http://127.0.0.1:3107/login',
    timeout: 120000,
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3107/api', NEXT_PUBLIC_BASE_URL: 'http://127.0.0.1:3107' },
  },
});
