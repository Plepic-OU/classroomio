import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: './features/',
  steps: './steps/',
  importTestFrom: './fixtures/auth.fixture.ts',
});

export default defineConfig({
  testDir,
  globalSetup: './global-setup.ts',
  timeout: 10_000,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'on',
    screenshot: 'on',
  },
  projects: [
    {
      name: 'setup',
      testDir: './setup',
      testMatch: '**/*.setup.ts',
      timeout: 30_000,
    },
    {
      name: 'login-tests',
      testDir,
      testMatch: '**/login.feature.spec.js',
      dependencies: ['setup'],
      use: {
        // Login tests need a clean session — no storageState
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'unauth-tests',
      testDir,
      testMatch: '**/auth-redirect.feature.spec.js',
      dependencies: ['setup'],
      use: {
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'tests',
      testDir,
      testMatch: '**/!(login|auth-redirect).feature.spec.js',
      dependencies: ['setup'],
      use: {
        storageState: '.auth/user.json',
      },
    },
  ],
});
