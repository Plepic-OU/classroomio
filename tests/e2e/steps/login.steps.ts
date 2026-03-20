import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am on the login page', async ({ loginPage }) => {
  await loginPage.goto();
});

When('I log in as an admin', async ({ loginPage }) => {
  await loginPage.login(process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
});

Then('I should be redirected to the dashboard', async ({ loginPage }) => {
  await loginPage.expectDashboard();
});

// Reusable step shared with course-creation feature
Given('I am logged in as an admin', async ({ loginPage }) => {
  await loginPage.goto();
  await loginPage.login(process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
  await loginPage.expectDashboard();
});
