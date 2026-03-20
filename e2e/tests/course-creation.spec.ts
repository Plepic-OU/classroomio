import { test, expect } from '@playwright/test';

// Course creation includes login + navigation + modal + multiple Supabase writes,
// which exceeds the 10s global timeout. Use a per-test budget of 20s.
test('logged-in user creates a new course', { timeout: 20_000 }, async ({ page }) => {
  // Login via UI
  await page.goto('/login');
  await page.waitForTimeout(2000);

  await page.getByPlaceholder('you@domain.com').fill('admin@test.com');
  await page.getByPlaceholder('************').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/org\/.+/);

  // Navigate to courses with create modal open via URL param
  await page.goto('/org/udemy-test/courses?create=true');

  // Wait for SvelteKit hydration — modal buttons are SSR-rendered but
  // on:click handlers aren't attached until client JS hydrates.
  await page.waitForTimeout(2000);

  // Step 0: Select course type (default Live Class), click Next
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 1: Enter title + description, click Finish
  await page.getByPlaceholder('Your course name').fill('Playwright Test Course');
  await page.getByPlaceholder('A little description about this course').fill('E2E test course description');
  await page.getByRole('button', { name: 'Finish' }).click();

  // After creation, app redirects to /courses/[id] — verify course title visible
  await expect(page).toHaveURL(/\/courses\/.+/);
  await expect(page.getByText('Playwright Test Course')).toBeVisible();
});
