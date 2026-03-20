import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// No dotenv import needed — Playwright 1.35+ reads .env natively.

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['fixtures.ts', 'steps/**/*.steps.ts'],
});

export default defineConfig({
  testDir,
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  timeout: 10_000,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    storageState: '.auth/state.json',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
