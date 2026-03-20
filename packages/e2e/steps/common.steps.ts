import { createBdd } from 'playwright-bdd';

const { When: when } = createBdd();

when('I click the {string} button', async ({ page }, buttonName: string) => {
  await page.getByRole('button', { name: buttonName }).click();
});
