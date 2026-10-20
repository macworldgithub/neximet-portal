import { defineConfig } from '@playwright/test';
import { callBrowserOptions } from './scripts/call-test-media.mjs';

export default defineConfig({
  testDir: './tests/calls', timeout: 90000, workers: 1, fullyParallel: false,
  reporter: 'list', outputDir: './test-results/calls',
  use: { baseURL: 'http://127.0.0.1:3110', headless: true, screenshot: 'only-on-failure', serviceWorkers: 'block',
    launchOptions: callBrowserOptions },
  webServer: [
    { command: 'node ../backend/scripts/chat-qa-server.js', url: 'http://127.0.0.1:4012/api/projects', timeout: 60000, reuseExistingServer: false,
      env: { QA_PORT: '4012', QA_ORIGIN: 'http://127.0.0.1:3110', CORS_ORIGINS: 'http://127.0.0.1:3110', NODE_ENV: 'test' } },
    { command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3110', url: 'http://127.0.0.1:3110/login', timeout: 120000, reuseExistingServer: false,
      env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4012/api', NEXT_PUBLIC_BASE_URL: 'http://127.0.0.1:4012', NEXT_DIST_DIR: '.next-calls' } },
  ],
});
