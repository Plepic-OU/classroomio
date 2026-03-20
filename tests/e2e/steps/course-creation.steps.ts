import { expect } from '@playwright/test';
import { Given, When, Then, waitForHydration } from './fixtures';

Given(
  'I am logged in as {string} with password {string}',
  async ({ page }, email: string, password: string) => {
    await page.goto('/login');
    await waitForHydration(page);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL('**/org/**');
  }
);

Given('I am on the courses page', async ({ page }) => {
  await page.waitForURL('**/org/**');
  const url = page.url();
  const orgSlug = url.match(/\/org\/([^/]+)/)?.[1];
  await page.goto(`/org/${orgSlug}/courses`);
  await waitForHydration(page);
});

When('I click the create course button', async ({ page }) => {
  await page.getByRole('button', { name: /create course/i }).click();
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
