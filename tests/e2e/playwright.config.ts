import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['steps/**/*.steps.ts', 'steps/hooks.ts', 'steps/fixtures.ts'],
  importTestFrom: 'steps/fixtures.ts',
  outputDir: '.features-gen',
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
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  retries: 1,
  workers: 1,
  // No webServer — services must be started manually before running tests.
  // The globalSetup preflight check verifies they are reachable.
});
