import { expect } from '@playwright/test';
import { Given, When, Then, waitForHydration } from './fixtures';

Given('I am on the community page', async ({ page }) => {
  await page.goto('/org/udemy-test/community');
  await waitForHydration(page);
});

When('I click the ask community button', async ({ page }) => {
  await page.getByRole('button', { name: /ask community/i }).click();
});

When('I enter the question title {string}', async ({ page }, title: string) => {
  await page.getByPlaceholder('Title').fill(title);
});

When('I select a course for the question', async ({ page }) => {
  // Carbon Dropdown: click the trigger button to open, then select first item
  await page.getByRole('button', { name: /select course/i }).click();
  await page.locator('.bx--list-box__menu-item').first().click();
});

When('I enter the question body {string}', async ({ page }, body: string) => {
  // TinyMCE renders inside an iframe -- find the iframe and type into it
  const editorFrame = page.frameLocator('iframe[title="Rich Text Area"]');
  await editorFrame.locator('body').click();
  await editorFrame.locator('body').fill(body);
});

When('I click the publish button', async ({ page }) => {
  await page.getByRole('button', { name: /publish/i }).click();
});

Then(
  'I should see {string} on the question page',
  async ({ page }, title: string) => {
    // After publish, the app redirects to the question detail page.
    // Use getByRole('heading') to match the title specifically (not body text).
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
);
