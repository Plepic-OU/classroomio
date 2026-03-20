import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, 'e2e/.auth/user.json');

const testDir = defineBddConfig({
  features: 'e2e/features/**/*.feature',
  steps: ['e2e/steps/**/*.steps.ts', 'e2e/fixtures/index.ts'],
  disableWarnings: { importTestFrom: true },
});

export default defineConfig({
  testDir,
  timeout: 10_000,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    video: 'on',
    screenshot: 'on',
    trace: 'on',
  },
  // No webServer block — services must be started manually before running tests
  projects: [
    {
      name: 'setup',
      testDir: './e2e/steps',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      grepInvert: /@unauthenticated/,
    },
    {
      name: 'chromium-unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      grep: /@unauthenticated/,
    },
  ],
});
