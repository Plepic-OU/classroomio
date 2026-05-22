import { test as setup } from '@playwright/test';
import { loginAs } from './helpers/login';
import path from 'node:path';

const authFile = path.join(__dirname, 'playwright/.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  await loginAs(page, 'admin@test.com');
  await page.context().storageState({ path: authFile });
});
