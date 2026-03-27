import { test as setup, expect } from '@playwright/test';
import 'dotenv/config';

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'testuser@classroomio.test';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'TestPass123!';

setup('authenticate test user', async ({ page }) => {
  // Wait for SvelteKit hydration before interacting with the form.
  // The form uses on:submit|preventDefault which only works after hydration.
  // Detect hydration by listening for the "Welcome to ClassroomIO" console.log
  // emitted by +layout.svelte's onMount/pageSetup.
  const hydrationPromise = page.waitForEvent('console', {
    predicate: (msg) => msg.text().includes('Welcome to ClassroomIO'),
    timeout: 15000
  });

  await page.goto('/login');
  await hydrationPromise;

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
