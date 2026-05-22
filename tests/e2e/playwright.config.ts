import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  // Include fixtures/test.ts so playwright-bdd can locate the extended `test` export.
  // Required when steps import Given/When/Then from a fixtures module rather than calling
  // createBdd() inline. Error message: "Can't guess test instance for: ..." otherwise.
  steps: ['steps/**/*.steps.ts', 'fixtures/test.ts'],
  outputDir: '.features-gen',
});

const AUTH_SETUP_DIR = path.resolve(__dirname, 'auth-setup');

export default defineConfig({
  testDir,
  globalSetup: require.resolve('./helpers/preflight'),
  reporter: [
    ['html', { host: '0.0.0.0', port: 9323, open: 'never' }],
  ],
  timeout: 15_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    trace: 'on',
    video: 'on',
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
  },
  projects: [
    // One-time UI login per persona; saves storageState to tests/e2e/.auth/<persona>.json.
    // Design 2026-05-15 §3 + §5.
    {
      name: 'auth-setup',
      testDir: AUTH_SETUP_DIR,
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    // BDD project: depends on auth-setup so .auth/<persona>.json exist before any scenario
    // tagged @persona-* runs. The storageState fixture override in fixtures/test.ts picks
    // the file based on tags.
    {
      name: 'chromium',
      testDir,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['auth-setup']
    },
  ],
  retries: 0,
  workers: 1,
  // No webServer — services must be started manually before running tests.
  // The globalSetup preflight check verifies they are reachable.
});
