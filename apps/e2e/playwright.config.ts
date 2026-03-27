import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['steps/**/*.steps.ts', 'fixtures/base.ts'],
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  timeout: 30000,         // 30s total per test (login + redirect can take ~10-15s)
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
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    },
  },
});
