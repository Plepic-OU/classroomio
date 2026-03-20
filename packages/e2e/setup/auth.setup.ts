import { test as setup } from '@playwright/test';
import 'dotenv/config';

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'testuser@classroomio.test';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'TestPass123!';

setup('authenticate test user', async ({ page }) => {
  await page.goto('/login');

  // Wait for SvelteKit hydration to complete before interacting with the form
  await page.waitForTimeout(1000);

  const emailInput = page.getByPlaceholder('you@domain.com');
  await emailInput.fill(TEST_USER_EMAIL);

  const passwordInput = page.getByPlaceholder('************');
  await passwordInput.fill(TEST_USER_PASSWORD);

  await page.getByRole('button', { name: /log in/i }).click();

  // Wait for redirect to org page (may be /org/{slug} or /org/{slug}/courses)
  await page.waitForURL('**/org/**');

  // Save storage state for reuse by test projects
  await page.context().storageState({ path: '.auth/user.json' });
});
