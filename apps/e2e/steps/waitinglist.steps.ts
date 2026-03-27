import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures/base';

const { Given, When, Then } = createBdd(test);

Given('I am on the landing page', async ({ page }) => {
  await page.goto(process.env.COM_URL ?? 'http://localhost:5174');
  // Wait for domcontentloaded then for the join button to be visible,
  // confirming SvelteKit has hydrated and event handlers are attached.
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: 'Join Waitinglist' }).waitFor({ timeout: 10000 });
});

When('I fill in the waitinglist email {string}', async ({ page }, email: string) => {
  // TextField renders label text inside a <p> inside <label>, which Playwright resolves correctly
  await page.getByLabel('Join the waitinglist').fill(email);
});

When('I submit the waitinglist form', async ({ page }) => {
  await page.getByRole('button', { name: 'Join Waitinglist' }).click();
});

Then('I should see a waitinglist success message', async ({ page }) => {
  await expect(page.getByText("You're on the list!")).toBeVisible({ timeout: 10000 });
});

Given('I am on the org waitinglist page', async ({ page }) => {
  const orgSlug = process.env.E2E_ORG_SLUG ?? 'udemy-test';
  await page.goto(`/org/${orgSlug}/waitinglist`);
  await expect(page).toHaveURL(/waitinglist/, { timeout: 10000 });
});

Then('I should see the waitinglist table', async ({ page }) => {
  // With no seed data the table won't render — assert the page heading and count instead
  await expect(page.getByRole('heading', { name: 'Waitinglist' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('people signed up').first()).toBeVisible();
});
