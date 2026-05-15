import { createBdd } from 'playwright-bdd';

const { Given } = createBdd();

Given('I am on the courses page', async ({ page }) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await page.waitForURL(/\/courses/);
});
