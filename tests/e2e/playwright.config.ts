import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['fixtures.ts', 'steps/**/*.ts'],
  outputDir: '.features-gen',
  // @known-issue scenarios document a suspected real app bug (see
  // .claude/skills/bdd-extend/references/suspected-bugs.md) and are meant to stay out of
  // normal runs rather than turn the suite red — excluded at generation time, not just
  // skipped, so they don't even land in .features-gen/. To check one manually once the
  // underlying bug might be fixed: `npx bddgen --config tests/e2e/playwright.config.ts --tags "@known-issue"`.
  tags: 'not @known-issue'
});

export default defineConfig({
  testDir,
  globalSetup: require.resolve('./helpers/preflight'),
  reporter: [['html', { host: '0.0.0.0', port: 9323, open: 'never' }]],
  timeout: 10_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    trace: 'on',
    video: 'on',
    actionTimeout: 10_000,
    navigationTimeout: 10_000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  retries: 0,
  workers: 1
  // No webServer — services must be started manually before running tests.
  // The globalSetup preflight check verifies they are reachable.
});
