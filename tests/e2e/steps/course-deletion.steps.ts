import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I am on the org courses page', async ({ page }) => {
  // After login, we land at /org/<slug>/... — extract the slug and navigate to courses
  const url = page.url();
  const orgMatch = url.match(/\/org\/[^/?]+/);
  const orgPath = orgMatch ? orgMatch[0] : '/org/udemy-test';
  await page.goto(orgPath + '/courses');
  await page.waitForURL(/\/org\/.+\/courses/);
  // Wait for course cards to render (async fetch)
  await page.getByRole('heading', { level: 3 }).first().waitFor({ state: 'visible' });
});

When(
  'I hover over the course card for {string}',
  async ({ page }, courseTitle: string) => {
    // Course cards have role="button" — hover triggers group-hover CSS on children
    const card = page.getByRole('button').filter({ hasText: courseTitle }).first();
    await card.hover();
  }
);

When(
  'I open the overflow menu on the {string} card',
  async ({ page }, courseTitle: string) => {
    // The OverflowMenu trigger button is opacity-0 until hover; use force:true to click it
    const card = page.getByRole('button').filter({ hasText: courseTitle }).first();
    await card.hover();
    // Carbon OverflowMenu renders a trigger button with class bx--overflow-menu
    await card.locator('.bx--overflow-menu').click({ force: true });
  }
);

When('I click the {string} option in the overflow menu', async ({ page }, optionText: string) => {
  // OverflowMenu items render as menuitems in a popup
  await page.getByRole('menuitem', { name: optionText }).click();
});

Then('the delete confirmation modal should appear', async ({ page }) => {
  // DeleteModal content uses translation key delete_modal.content = "Are you sure?"
  await expect(page.getByText('Are you sure?').first()).toBeVisible();
});

When('I confirm the deletion', async ({ page }) => {
  // DeleteModal "Yes" button (delete_modal.yes = "Yes")
  await page.getByRole('button', { name: 'Yes' }).click();
});

Then(
  '{string} should no longer be visible on the page',
  async ({ page }, courseTitle: string) => {
    await expect(page.getByText(courseTitle).first()).not.toBeVisible();
  }
);
