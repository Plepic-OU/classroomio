import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 10_000,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    video: 'on',
    trace: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { host: '0.0.0.0', port: 9323 }],
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  retries: 0,
  globalSetup: './global-setup.ts',
});
