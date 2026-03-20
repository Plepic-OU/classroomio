import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 15_000 },
  // Run tests sequentially: all tests share the same auth-state.json (one Supabase
  // refresh token). Parallel execution lets the logout test revoke that token mid-run,
  // breaking other workers that need to refresh their JWT.
  workers: 1,
  globalSetup: './global-setup.ts',
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    video: 'on',
    screenshot: 'on',
    trace: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'auth-state.json' },
    },
  ],
});
