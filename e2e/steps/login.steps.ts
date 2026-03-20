import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { LoginPage } from '../pages/login.page';

const { Given, When, Then } = createBdd();

Given('I am on the login page', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
});

When('I login with {string} and {string}', async ({ page }, email: string, password: string) => {
  const loginPage = new LoginPage(page);
  await loginPage.login(email, password);
});

Then('I should be redirected to the dashboard', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.expectDashboardRedirect();
});

Then('I should see a login error message', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.expectError();
});
