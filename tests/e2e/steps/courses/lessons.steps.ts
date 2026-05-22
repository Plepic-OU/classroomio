import { expect } from '@playwright/test';
import { When, Then } from '../fixtures';

When('I navigate to the course content tab', async ({ page }) => {
  await page.getByRole('button', { name: 'Content' }).click();
  await page.waitForURL(/\/lessons$/);
});

When('I click the add lesson button', async ({ page }) => {
  await page.getByRole('button', { name: /^add$/i }).click();
});

When('I enter the new lesson title {string}', async ({ page }, title: string) => {
  // TextField wraps input in label with <p> for text — getByLabel doesn't resolve; target input directly
  await page.locator('.dialog input').fill(title);
});

When('I save the new lesson', async ({ page }) => {
  await page.locator('.dialog').getByRole('button', { name: /save/i }).click();
});

Then('I should see the lessons page with an add button', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^add$/i })).toBeVisible();
});

Then('I should see the new section on the lessons page', async ({ page }) => {
  await page.getByText('Introduction to Testing').first().waitFor({ timeout: 10_000 });
});
