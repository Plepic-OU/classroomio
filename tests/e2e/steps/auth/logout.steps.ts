import { Given, When, Then } from '../../fixtures';

Given('I am on the org dashboard', async ({ page }) => {
  await page.goto('/org/udemy-test/courses');
  await page.waitForSelector('aside', { state: 'visible' });
});

When('I open the profile menu', async ({ page }) => {
  // Profile button in sidebar contains the user's full name as visible text
  // TODO: verify selector — button is identified by visible name "Elon Gates"
  await page.getByRole('button', { name: /elon gates/i }).click();
});

When('I click the log out button', async ({ page }) => {
  await page.getByRole('button', { name: /log out/i }).click();
});

Then('I should be on the login page', async ({ page }) => {
  await page.waitForURL(/\/login/);
});
