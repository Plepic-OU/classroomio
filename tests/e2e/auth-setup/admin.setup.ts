import { test as setup } from '@playwright/test';
import path from 'node:path';
import { loginAs } from '../helpers/login';

const ADMIN_AUTH_FILE = path.resolve(__dirname, '..', '.auth', 'admin.json');

setup('authenticate as admin', async ({ page, context }) => {
  await loginAs(page, 'admin@test.com');
  // Persist storage state once. The fixtured `storageState` in fixtures/test.ts reads this file
  // for any scenario tagged @persona-admin or @persona-teacher.
  await context.storageState({ path: ADMIN_AUTH_FILE });
});
