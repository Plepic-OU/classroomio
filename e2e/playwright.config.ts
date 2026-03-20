import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.steps.ts',
  importTestFrom: 'fixtures/index.ts',
});

export default defineConfig({
  testDir,
  timeout: 30_000,  // per-test timeout; course creation involves multiple Supabase calls
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './global-setup.ts',
  outputDir: 'test-results',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    locale: 'en',
    screenshot: 'on',
    video: 'on',
  },
  projects: [
    // Unauthenticated project — login flows, no pre-loaded session
    {
      name: 'unauthenticated',
      testMatch: /login\.feature/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Authenticated project — all other flows use saved admin session
    {
      name: 'authenticated',
      testIgnore: /login\.feature/,
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/admin.json' },
    },
  ],
  // No webServer block — tests MUST NOT auto-start services.
  // The dashboard and Supabase must be running before invoking `pnpm e2e`.
  // globalSetup performs a preflight check and fails fast if they are not reachable.
});
