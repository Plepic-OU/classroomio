import { test as setup } from '@playwright/test';
import { TEST_USERS } from './helpers/test-users';

const roles = [
  { name: 'admin',   file: '.auth/admin.json',   waitFor: /\/org\//,  ...TEST_USERS.admin },
  { name: 'student', file: '.auth/student.json',  waitFor: /\/lms/,    ...TEST_USERS.student },
  // teacher added in Phase 3 — waitFor: /\/lms/
] as const;

for (const role of roles) {
  setup(`authenticate as ${role.name}`, async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').waitFor();
    await page.getByPlaceholder('you@domain.com').fill(role.email);
    await page.getByPlaceholder('************').fill(role.password);
    await page.getByRole('button', { name: /log\s*in/i }).first().click();
    await page.waitForURL(role.waitFor);
    await page.evaluate(() => localStorage.setItem('lang', 'en'));
    await page.context().storageState({ path: role.file });
  });
}
