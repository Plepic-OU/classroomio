import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['steps/**/*.ts', 'fixtures/index.ts']
});

export default defineConfig({
  testDir,
  timeout: 10_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  globalSetup: './global-setup.ts',

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],

  use: {
    baseURL: process.env.DASHBOARD_URL || 'http://localhost:5173',
    video: 'on',
    screenshot: 'on',
    trace: 'on',
    actionTimeout: 8_000,
    navigationTimeout: 10_000
  },

  outputDir: 'test-results',

  projects: [
    // Login tests run without stored auth (they test the login flow itself)
    {
      name: 'login',
      testMatch: '**/.features-gen/features/auth/**',
      use: { ...devices['Desktop Chrome'] }
    },
    // All other tests use pre-authenticated state from global setup
    {
      name: 'chromium',
      testIgnore: '**/.features-gen/features/auth/**',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/admin.json'
      }
    }
  ]
});
