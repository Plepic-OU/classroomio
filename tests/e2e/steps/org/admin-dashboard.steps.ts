import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../../fixtures/test';
import { waitForRouteHydration } from '../../helpers/hydration';
import { escapeRegex } from '../../selectors';
import { TEST_USERS } from '../../helpers/test-users';

const { Given, Then } = createBdd(test);

const admin = TEST_USERS.admin;

Given('I am on the admin dashboard', async ({ page }) => {
  await page.goto(`/org/${admin.orgSlug}`);
  await waitForRouteHydration(page, `/org/${admin.orgSlug}`);
});

Then('I should see the seed organisation in the sidebar', async ({ page }) => {
  // The Org sidebar renders the org name inside a header button whose
  // accessible name is "<initials> <orgName> <plan>" — e.g. "UD Udemy Test
  // Enterprise" for the seed admin. We match by the org name substring so
  // initials/plan changes don't break the assertion.
  await expect(
    page.getByRole('button', { name: new RegExp(escapeRegex(admin.orgName), 'i') }).first(),
  ).toBeVisible();
});

Then('the dashboard should greet the admin by name', async ({ page }) => {
  // The dashboard renders "<Greeting> <fullname>!" as an <h1>. We match the
  // fullname loosely so the time-of-day greeting drift (Morning/Afternoon/
  // Evening) doesn't flake the assertion.
  await expect(
    page.getByRole('heading', { name: new RegExp(escapeRegex(admin.fullname), 'i'), level: 1 }),
  ).toBeVisible();
});
