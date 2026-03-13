import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// Shared step used by Background in course-creation.feature
Given('I am logged in as a teacher', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/org/**');
});

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I fill in the email {string}', async ({ page }, email: string) => {
  await page.locator('input[type="email"]').fill(email);
});

When('I fill in the password {string}', async ({ page }, password: string) => {
  await page.locator('input[type="password"]').fill(password);
});

When('I click the login button', async ({ page }) => {
  await page.getByRole('button', { name: 'Log In' }).click();
});

Then('I should be redirected to my organisation dashboard', async ({ page }) => {
  await page.waitForURL('**/org/**');
});
