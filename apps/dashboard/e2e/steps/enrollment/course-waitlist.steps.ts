import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { Then } = createBdd(test);

Then('I should see {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text)).toBeVisible({ timeout: 10000 });
});

Then('I should see a {string} button', async ({ page }, buttonName: string) => {
  const button = page.getByRole('button', { name: new RegExp(buttonName, 'i') });
  await expect(button).toBeVisible({ timeout: 10000 });
});
