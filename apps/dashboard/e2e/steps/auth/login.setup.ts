import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test as setup } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const authFile = path.join(__dirname, '../../.auth/user.json');
const contextFile = path.join(__dirname, '../../.auth/context.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL ?? 'admin@test.com');
  await page.locator('input[type="password"]').fill(process.env.TEST_PASSWORD ?? '123456');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(/\/(org|lms)\//);

  const slugMatch = page.url().match(/\/org\/([^/]+)/);
  if (slugMatch) {
    fs.writeFileSync(contextFile, JSON.stringify({ orgSlug: slugMatch[1] }));
  }

  await page.context().storageState({ path: authFile });
});
