import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { STORAGE_STATE } from './global-setup';

const testDir = defineBddConfig({
  features: './features/**/*.feature',
  steps: './steps/**/*.ts',
});

export default defineConfig({
  testDir,
  timeout: 10_000,
  expect: { timeout: 5_000 },
  retries: 0,
  workers: 3,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    video: 'on',
    trace: 'on',
  },
  projects: [
    {
      name: 'login',
      use: { browserName: 'chromium' },
      testMatch: /login\.feature/,
    },
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        storageState: STORAGE_STATE,
      },
      testIgnore: /login\.feature/,
    },
  ],
  reporter: [['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
});
