import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: './features/',
  steps: ['./steps/', './fixtures/auth.fixture.ts'],
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
    },
    {
      name: 'tests',
      testDir,
      dependencies: ['setup'],
      use: {
        storageState: '.auth/user.json',
      },
    },
  ],
});
