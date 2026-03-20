import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/*.feature',
  steps: 'steps/**/*.ts',
});

export default defineConfig({
  testDir,
  globalSetup: './global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on',
    video: 'on',
    screenshot: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['html', { port: 9323, open: 'never' }]],
  timeout: 10_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results',
});
