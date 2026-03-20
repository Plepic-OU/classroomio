import { expect } from '@playwright/test';
import { Given, When, Then } from '../../fixtures/index';

// Auth is pre-loaded via storageState (see playwright.config.ts chromium project).
// This step just confirms we are authenticated by navigating and waiting for redirect.
Given('I am logged in as admin', async ({ page }) => {
  await page.goto('/');
  // Wait for getProfile to finish and redirect to the org dashboard
  await page.waitForURL((url) => url.pathname.startsWith('/org/'), { timeout: 8000 });
});

Given('I am on the courses page', async ({ page }) => {
  // Use sidebar link (client-side nav) to preserve Svelte store state
  // so isOrgAdmin is still set and Create Course button is enabled immediately
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.waitForURL(/\/courses/, { timeout: 5000 });
  await expect(page.getByRole('button', { name: /create course/i })).toBeEnabled({
    timeout: 5000
  });
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
});

When('I select the course type', async ({ page }) => {
  await page.getByRole('button', { name: /live class|self paced/i }).first().click();
  await page.getByRole('button', { name: /next/i }).click();
});

When('I fill in the course name {string}', async ({ page }, title: string) => {
  await page.getByLabel('Course name').fill(title);
  // TextArea has an AI popover textarea inside the label too, so getByLabel returns multiple matches.
  // Use getByPlaceholder to target the specific description textarea.
  await page.getByPlaceholder('A little description about this course').fill('Test course description');
});

When('I submit the course form', async ({ page }) => {
  await page.getByRole('button', { name: /finish/i }).click();
});

Then('I should see {string} in the courses list', async ({ page }, title: string) => {
  await expect(page.getByTestId('course-title').filter({ hasText: title })).toBeVisible({
    timeout: 8000
  });
});
