import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// Shared step used by Background in course-creation.feature.
// Auth state is pre-loaded from auth-state.json (saved in global-setup).
// Navigate directly to courses — Supabase uses localStorage (no server cookie)
// so any redirect would be slow. Skip the intermediate dashboard page.
Given('I am logged in as a teacher', async ({ page }) => {
  await page.goto('/org/udemy-test/courses');
  await page.getByRole('button', { name: 'Create Course' }).waitFor();
});

// Login test clears the pre-loaded auth so it can verify the actual login flow.
// Navigate to the app origin first so page.evaluate can access localStorage —
// localStorage.clear() is not available on about:blank.
Given('I am on the login page', async ({ page }) => {
  await page.goto('/');
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
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
