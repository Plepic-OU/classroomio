import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('I click the {string} sidebar link', async ({ page }, linkName: string) => {
  await page.getByRole('link', { name: new RegExp(linkName, 'i') }).click();
});

Then('I should be on the community page', async ({ page }) => {
  await page.waitForURL(/\/community/);
});

Then('I should be on the audience page', async ({ page }) => {
  await page.waitForURL(/\/audience/);
});
