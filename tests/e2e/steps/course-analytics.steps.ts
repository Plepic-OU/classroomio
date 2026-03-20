import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, Then } = createBdd();

Given('I am on the analytics page for course {string}', async ({ page }, courseTitle: string) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const res = await fetch(
    `http://localhost:54321/rest/v1/course?title=eq.${encodeURIComponent(courseTitle)}&select=id`,
    { headers },
  );
  const [course] = await res.json();
  await page.goto(`/courses/${course.id}`);
  await page.getByRole('button', { name: 'Analytics' }).waitFor();
  await page.getByRole('button', { name: 'Analytics' }).click();
  await page.waitForURL('**/analytics');
});

Then('I should be on the analytics page', async ({ page }) => {
  // Navigation to /analytics is already confirmed in the Given step via waitForURL.
  // This assertion provides an explicit, URL-based verification as the Then step.
  await expect(page).toHaveURL(/\/analytics$/);
});
