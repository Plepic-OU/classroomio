import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

Given('I am logged in as a student', async ({ page }) => {
  // Start from the app root so localStorage is accessible, then clear the
  // pre-loaded admin auth state before logging in as the student.
  await page.goto('/');
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('student@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Log In' }).click();
  // Students are redirected to /lms (not /org) — they have no org-admin role.
  await page.waitForURL('**/lms**');
});

When('I navigate to the LMS explore page', async ({ page }) => {
  // Must use SPA navigation (click the sidebar link) instead of page.goto().
  // A full-page navigation triggers appSetup.ts → getProfile() which detects
  // a student account and unconditionally redirects to /lms, overriding the
  // /lms/explore destination.
  await page.getByRole('link', { name: 'Explore' }).click();
  await page.waitForURL('**/lms/explore**');
});

When(
  'I click "Learn more" for the {string} course',
  async ({ page }, courseName: string) => {
    // Course cards render only after $profile and $currentOrg are both loaded.
    // Waiting for the card to appear is sufficient — org is ready by then.
    // Course cards load async — wait for the specific card to appear.
    // On the explore page, isLMS=false so no inner "Learn more" button renders.
    // The entire card div is role="button" and navigates to /course/${slug} on click.
    const card = page.locator('div[role="button"]').filter({ hasText: courseName });
    await card.waitFor();
    await card.click();
    await page.waitForURL('**/course/**');
  },
);

Then('I should be on the LMS page', async ({ page }) => {
  await page.waitForURL('**/lms**');
});
