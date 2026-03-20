import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 15_000,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    video: 'on',
    trace: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { host: '0.0.0.0', port: 9323 }],
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  // Run tests serially — the SvelteKit dev server can't handle parallel browser
  // instances reliably (hydration races cause native form submits).
  workers: 1,
  retries: 1,
  globalSetup: './global-setup.ts',
});
