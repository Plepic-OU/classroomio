import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  // Include fixtures so playwright-bdd discovers the extended `test`
  // and BeforeScenario hooks. Step files import Given/When/Then from
  // fixtures/test.ts per design §5.2.
  steps: ['steps/**/*.steps.ts', 'fixtures/test.ts'],
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  globalSetup: require.resolve('./helpers/preflight'),
  reporter: [['html', { host: '0.0.0.0', port: 9323, open: 'never' }]],
  // 30s test timeout: dev-mode Vite hydration observed at ~8s on first
  // hit; the rest of a scenario (fill, click, nav) needs the remaining
  // headroom. Bump down again once we run against built bundles.
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    // Built-in failure artefacts (design §4.6). HTML report surfaces these
    // automatically — no manual AfterScenario screenshot needed.
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    // Bumped to match the 30s test timeout: dev-mode Vite hydration and
    // navigation between routes can each consume ~5–10s on a cold hit.
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
    // Locks the i18n locale so English regex matchers don't flap when a
    // seeded user's `profile.locale` changes (§4.6).
    extraHTTPHeaders: { 'Accept-Language': 'en-US' },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Local: flake-free with no retries. CI: one retry absorbs a network
  // blip; any test passing only on retry must be tagged `@flaky` during
  // triage (§4.6, §5.5).
  retries: process.env.CI ? 1 : 0,
  // Load-bearing for: shared DB reset, fixed auth.users seed, fixed test
  // data names (§4.6). Bumping past 1 requires re-thinking every one of
  // those.
  workers: 1,
  // No webServer — services must be started manually before running tests.
  // The globalSetup preflight check verifies they are reachable.
});
