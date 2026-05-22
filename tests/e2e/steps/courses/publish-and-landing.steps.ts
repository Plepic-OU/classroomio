import { Given, When, Then } from '../fixtures';
import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

let courseLink = '';
let anonContext: BrowserContext | null = null;
let anonPage: Page | null = null;

Given('I am on the course settings page', async ({ page }) => {
  const courseId = page.url().match(/\/courses\/([^/]+)$/)?.[1];
  await page.goto(`/courses/${courseId}/settings`);
  await expect(page).toHaveURL(/\/settings$/, { timeout: 15_000 });
});

When('I toggle the course to published', async ({ page }) => {
  // Carbon `<Toggle>` renders <input role="switch"> with NO accessible name
  // (aria-label="Toggle" is on the wrapping <label>). The Settings page has
  // multiple toggles, so scope by the "Publish Course" section row.
  const publishRow = page.locator('.bx--row').filter({ hasText: 'Publish Course' });
  const publishToggle = publishRow.getByRole('switch');
  if (!(await publishToggle.isChecked())) {
    await publishToggle.click();
  }
});

When('I save the course settings', async ({ page }) => {
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByText(/saved|success/i)).toBeVisible({ timeout: 10_000 });
});

Then('the course link should be displayed', async ({ page }) => {
  const snippet = page.locator('pre').filter({ hasText: /\/course\// }).first();
  await expect(snippet).toBeVisible({ timeout: 10_000 });
  courseLink = (await snippet.textContent())?.trim() ?? '';
  expect(courseLink).toMatch(/\/course\//);
});

When('an anonymous visitor opens the course link', async ({ browser }) => {
  anonContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  anonPage = await anonContext.newPage();
  const path = courseLink.replace(/^https?:\/\/[^/]+/, '');
  await anonPage.goto(path);
  await expect(anonPage).toHaveURL(/\/course\//, { timeout: 15_000 });
});

Then('they should see the course landing page', async () => {
  if (anonPage) {
    await expect(anonPage.getByText('BDD Landing Course')).toBeVisible({ timeout: 10_000 });
    await anonContext?.close();
    anonContext = null;
    anonPage = null;
  }
});
