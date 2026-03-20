import { expect } from '@playwright/test';
import { Given, When, Then, waitForHydration } from './fixtures';

Given('I am on the courses page', async ({ page }) => {
  await page.goto('/org/udemy-test/courses');
  await waitForHydration(page);
});

When('I click the create course button', async ({ page }) => {
  const btn = page.getByRole('button', { name: /create course/i });
  await expect(btn).toBeEnabled();
  await btn.click();
});

When('I select the {string} course type', async ({ page }, type: string) => {
  await page.getByRole('button', { name: new RegExp(`${type} This course type`, 'i') }).click();
});

When('I click the next button', async ({ page }) => {
  await page.getByRole('button', { name: /next/i }).click();
});

When('I enter the course name {string}', async ({ page }, name: string) => {
  await page.getByLabel('Course name').fill(name);
});

When('I enter the course description {string}', async ({ page }, description: string) => {
  await page.getByPlaceholder('A little description about this course').fill(description);
});

When('I click the finish button', async ({ page }) => {
  await page.getByRole('button', { name: /finish/i }).click();
});

Then(
  'I should see {string} in the course list',
  async ({ page }, title: string) => {
    await expect(page.getByText(title).first()).toBeVisible();
  }
);
