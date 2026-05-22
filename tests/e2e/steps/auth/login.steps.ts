import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures/test';
import { waitForRouteHydration } from '../../helpers/hydration';
import {
  loginEmail,
  loginPassword,
  loginSubmit,
  loginErrorBanner,
  profileMenuTrigger,
  logoutMenuItem,
} from '../../selectors';
import { userByEmail } from '../../helpers/test-users';

const { Given, When, Then } = createBdd(test);

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
  await waitForRouteHydration(page, '/login');
});

When('I enter email {string}', async ({ page }, email: string) => {
  await loginEmail(page).fill(email);
});

When('I enter password {string}', async ({ page }, password: string) => {
  await loginPassword(page).fill(password);
});

When('I click the login button', async ({ page }) => {
  await loginSubmit(page).click();
});

Then('I should be redirected to the org dashboard', async ({ page }) => {
  await page.waitForURL(/\/org\//);
});

Then('I should see an error message', async ({ page }) => {
  await loginErrorBanner(page).waitFor();
});

When('I log out', async ({ page }) => {
  // The logout step assumes the current scenario logged in as admin@test.com
  // (the only persona used by @noauth + UI-login scenarios in Phase 1). When
  // a second persona joins, lift the email into a parameter on the step.
  const { fullname } = userByEmail('admin@test.com');
  await profileMenuTrigger(page, fullname).click();
  await logoutMenuItem(page).click();
});

Then('I should be on the login page', async ({ page }) => {
  await page.waitForURL(/\/login\/?$/);
});
