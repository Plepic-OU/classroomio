import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { loginAs } from '../../helpers/login';

const { Given, When, Then } = createBdd();

Given('I am logged in as {string}', async ({ page, baseURL }, email: string) => {
  await loginAs(page, baseURL!, email);
});

Given('I am on the courses page', async ({ page }) => {
  await page.getByTestId('org-nav-courses').click();
  await page.waitForURL(/\/org\/[^/]+\/courses/);
});

When('I click the create course button', async ({ page }) => {
  // Admins start a course from the "Blank course" card, which opens the new-course dialog.
  // A click before hydration does nothing, so retry it, but never once the dialog is open.
  const dialog = page.getByRole('dialog');
  const blankCourseCard = page.getByRole('button', { name: /blank course/i });
  await expect(async () => {
    if (await dialog.isVisible()) return;
    await blankCourseCard.click({ timeout: 2_000 });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
});

When('I select a course type and proceed', async ({ page }) => {
  // The new-course dialog has two steps: step 0 = type selection, step 1 = title entry.
  // The first type (Self Paced) is pre-selected, so click Next to proceed.
  await page.getByRole('dialog').getByRole('button', { name: /next/i }).click();
});

When('I enter the course title {string}', async ({ page }, title: string) => {
  await page.getByPlaceholder(/course name/i).fill(title);
});

When('I enter the course description {string}', async ({ page }, description: string) => {
  await page.getByPlaceholder(/a little description/i).fill(description);
});

When('I submit the new course form', async ({ page }) => {
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /finish/i })
    .click();
});

Then('I should be redirected to the new course page', async ({ page }) => {
  await page.waitForURL(/\/courses\/[0-9a-f-]{36}(\/|$)/);
});
