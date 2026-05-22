import { config as dotenv } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

dotenv({ path: resolve(__dirname, '.env') });

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
  outputDir: '.features-gen',
  importTestFrom: 'helpers/fixtures.ts',
  // auth.setup.ts is a plain Playwright test file, not a BDD step file
});

export default defineConfig({
  testDir,
  globalSetup: require.resolve('./helpers/preflight'),
  reporter: [
    ['html', { host: '0.0.0.0', port: 9323, open: 'never' }],
  ],
  timeout: 10_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
  },
  projects: [
    { name: 'auth-setup', testMatch: /auth\.setup\.ts/, testDir: '.' },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['auth-setup'],
    },
  ],
  retries: 0,
  workers: 1,
  // No webServer — services must be started manually before running tests.
  // The globalSetup preflight check verifies they are reachable.
});
