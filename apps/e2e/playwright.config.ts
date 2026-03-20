import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  timeout: 10000,
  expect: { timeout: 5000 },
  globalSetup: './scripts/global-setup.ts',
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    headless: true,
    locale: 'en',
    video: 'on',
    screenshot: 'on',
    trace: 'on',
  },
});
