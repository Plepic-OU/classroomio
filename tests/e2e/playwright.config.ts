import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  // The fixtures/ files must be included so bddgen sees the extended `test`
  // (with $tags-resolved storageState) and the @mutating BeforeScenario hook.
  // See design §3 fixture wiring.
  steps: ['steps/**/*.steps.ts', 'fixtures/test.ts', 'fixtures/hooks.ts'],
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  globalSetup: require.resolve('./helpers/preflight'),
  reporter: [
    ['html', { host: '0.0.0.0', port: 9323, open: 'never' }],
  ],
  // Bumped from 10s to 30s: vite dev mode in this devcontainer averages
  // 2–4s per request even when warm, so the 10s budget is too tight for
  // a 6-step BDD scenario. The §1.2 perf target (<3s p50 read-only,
  // <10s mutating) assumes build+preview; revisit when §9's
  // "Build+preview vs pnpm dev for tests" deferred TODO lands.
  timeout: 30_000,
  expect: {
    // Bumped from 5s to 10s to match the actionTimeout/navigationTimeout
    // bumps — under slow vite-dev renders, expect.toBeVisible was flaking
    // on dashboard routes (observed Chunk E pass 2, F-03).
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    trace: 'on',
    video: 'on',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  retries: 0,
  workers: 1,
  // No webServer — services must be started manually before running tests.
  // The globalSetup preflight check verifies they are reachable.
});
