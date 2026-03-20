import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('I click on the course {string}', async ({ page }, courseTitle: string) => {
  // Course cards are div elements with on:click handlers (not links).
  // Click the heading text within the card.
  await page.getByRole('heading', { name: courseTitle }).click();
});

Then('I should be on the course detail page', async ({ page }) => {
  await expect(page).toHaveURL(/\/courses\/[a-f0-9-]+/);
});

Then(
  'I should see the course title {string} in the navigation',
  async ({ page }, title: string) => {
    await expect(page.getByText(title)).toBeVisible();
  }
);
