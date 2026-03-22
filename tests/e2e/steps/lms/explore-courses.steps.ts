import { createBdd } from 'playwright-bdd';

const { Then } = createBdd();

Then('I should be on the explore page', async ({ page }) => {
  await page.waitForURL(/\/lms\/explore/);
});
