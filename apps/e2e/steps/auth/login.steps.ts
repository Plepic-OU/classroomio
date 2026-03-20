import { expect } from '@playwright/test';
import { Given, When, Then } from '../../fixtures/index';

Given('I am on the login page', async ({ loginPage }) => {
  await loginPage.goto();
});

When('I enter email {string} and password {string}', async ({ loginPage }, email: string, password: string) => {
  await loginPage.fillEmail(email);
  await loginPage.fillPassword(password);
});

When('I submit the login form', async ({ loginPage }) => {
  await loginPage.submit();
});

Then('I should be redirected away from the login page', async ({ page }) => {
  await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
});

Then('I should see a login error message', async ({ loginPage }) => {
  const error = await loginPage.errorMessage();
  await expect(error).toBeVisible({ timeout: 8000 });
});
