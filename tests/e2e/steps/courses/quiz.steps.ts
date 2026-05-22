import { Given, When, Then } from '../fixtures';
import { expect } from '@playwright/test';

When('I click the add exercise button', async ({ page }) => {
  await page.getByRole('button', { name: /^add$/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
});

When('I choose to start from scratch', async ({ page }) => {
  await page.getByRole('dialog').getByText(/from scratch/i).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /^next$/i }).click();
});

When('I enter the exercise title {string}', async ({ page }, title: string) => {
  await page.getByPlaceholder(/exercise name/i).fill(title);
});

When('I finish creating the exercise', async ({ page }) => {
  await page.getByRole('dialog').getByRole('button', { name: /finish/i }).click();
});

Then('I should be on the exercise editor page', async ({ page }) => {
  await expect(page).toHaveURL(/\/exercises\/[^/]+/, { timeout: 15_000 });
  await expect(page.getByPlaceholder(/^question$/i).first()).toBeVisible({ timeout: 10_000 });
});

When('I fill in the last question with text {string}', async ({ page }, text: string) => {
  await page.getByPlaceholder(/^question$/i).last().fill(text);
});

When('I add a new question', async ({ page }) => {
  const before = await page.getByPlaceholder(/^question$/i).count();
  await page.locator('button.root.small').click();
  await expect(page.getByPlaceholder(/^question$/i)).toHaveCount(before + 1, { timeout: 10_000 });
});

When('I set the last question type to {string}', async ({ page }, type: string) => {
  await page.locator('select').last().selectOption({ label: type });
});

When('I save the exercise', async ({ page }) => {
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page).toHaveURL(/\/exercises$/, { timeout: 15_000 });
});

Then('I should see the exercise {string} in the exercises list', async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 10_000 });
});
