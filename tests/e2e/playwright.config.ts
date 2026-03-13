import { defineConfig, devices } from '@playwright/test';
import { defineBddProject } from 'playwright-bdd';
import { config } from 'dotenv';

config(); // loads .env automatically

export default defineConfig({
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    trace: 'on-first-retry',
  },
  projects: [
    defineBddProject({
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      features: 'features/**/*.feature',
      steps: 'steps/**/*.ts',
    }),
  ],
});
