import { Given, When, Then } from '../fixtures';
import { expect } from '@playwright/test';
import { loginAs } from '../../helpers/login';

Given('I am logged in as a student {string}', async ({ page }, email: string) => {
  await loginAs(page, email);
});

When('I navigate to the org courses page {string}', async ({ page }, slug: string) => {
  await page.goto(`/org/${slug}/courses`);
  await expect(page).toHaveURL(new RegExp(`/org/${slug}/courses`), { timeout: 15_000 });
});

Then('the create course button should be disabled', async ({ page }) => {
  const cta = page.getByRole('button', { name: /create course/i });
  await expect(cta).toBeVisible({ timeout: 10_000 });
  await expect(cta).toBeDisabled();
});
