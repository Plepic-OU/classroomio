import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, Then } = createBdd();

Given('I am on the marks page for course {string}', async ({ page }, courseTitle: string) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const res = await fetch(
    `http://localhost:54321/rest/v1/course?title=eq.${encodeURIComponent(courseTitle)}&select=id`,
    { headers },
  );
  const [course] = await res.json();
  await page.goto(`/courses/${course.id}`);
  await page.getByRole('button', { name: 'Marks' }).waitFor();
  await page.getByRole('button', { name: 'Marks' }).click();
  await page.waitForURL('**/marks');
});

Then('I should be on the marks page', async ({ page }) => {
  await expect(page).toHaveURL(/\/marks$/);
});
