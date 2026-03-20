import { defineConfig, devices } from '@playwright/test';
import { defineBddProject } from 'playwright-bdd';
import { config } from 'dotenv';

config(); // loads .env automatically

export default defineConfig({
  // Run tests serially — the local Vite dev server and Supabase can't reliably handle
  // multiple concurrent browser contexts without action timeouts.
  workers: 1,
  // actionTimeout: each individual action (click, fill, waitForURL) fails within 10 s
  // if the element is not found or the action does not complete. This gives fast
  // troubleshooting feedback without capping the total multi-step test at 10 s.
  // The overall test timeout (default 30 s) covers the sum of all steps.
  use: {
    baseURL: 'http://localhost:5173',
    actionTimeout: 10_000,   // each action (click/fill/waitForURL) fails within 10 s
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    storageState: 'auth-state.json', // pre-loaded auth; avoids slow UI login in every test
  },
  expect: {
    timeout: 10_000, // each expect assertion waits up to 10 s for the element/condition
  },
  globalSetup: './global-setup.ts',
  reporter: [['html', { open: 'never' }]],
  projects: [
    defineBddProject({
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      features: 'features/**/*.feature',
      steps: 'steps/**/*.ts',
    }),
  ],
});
