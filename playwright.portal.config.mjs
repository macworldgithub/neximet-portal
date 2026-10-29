import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/portal', timeout: 45000, workers: 1, reporter: 'list', outputDir: './test-results/portal',
  use: { baseURL: 'http://127.0.0.1:3111', headless: true, screenshot: 'only-on-failure', serviceWorkers: 'block' },
  webServer: { command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3111', url: 'http://127.0.0.1:3111/login', timeout: 120000, reuseExistingServer: false, env: { NEXT_DIST_DIR: '.next-portal', NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3111/api', NEXT_PUBLIC_BASE_URL: 'http://127.0.0.1:3111' } },
});
