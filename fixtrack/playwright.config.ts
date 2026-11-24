import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './browser-tests', timeout: 30000, fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5174', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node scripts/start-test-server.mjs', url: 'http://127.0.0.1:5174', reuseExistingServer: false, timeout: 30000 },
    { command: 'node scripts/start-test-server.mjs --cloud', url: 'http://127.0.0.1:5176', reuseExistingServer: false, timeout: 30000 },
  ],
  projects: [
    { name: 'desktop', testIgnore: '**/cloud-auth.spec.ts', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', testIgnore: '**/cloud-auth.spec.ts', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'chrome' } },
    { name: 'connected-auth', testMatch: '**/cloud-auth.spec.ts', use: { baseURL: 'http://127.0.0.1:5176', viewport: { width: 1280, height: 900 } } },
  ],
  reporter: 'list',
});
