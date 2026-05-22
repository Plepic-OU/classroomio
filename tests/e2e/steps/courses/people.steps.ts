import { Given, When, Then } from '../fixtures';
import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { TEST_USERS } from '../../helpers/test-users';

let inviteLink = '';
let studentContext: BrowserContext | null = null;
let studentPage: Page | null = null;

Given('I am on the people invite page of that course', async ({ page }) => {
  const courseId = page.url().match(/\/courses\/([^/]+)$/)?.[1];
  await page.goto(`/courses/${courseId}/people?add=true`);
  // The Modal component uses role="presentation", not role="dialog". Wait for the
  // unique "Invite Students" subheading inside the modal instead.
  await expect(page.getByText(/invite students/i)).toBeVisible({ timeout: 15_000 });
});

When('I copy the student invite link', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: /copy link/i }).click();
  inviteLink = await page.evaluate(() => navigator.clipboard.readText());
});

Then('I should see the copied confirmation', async ({ page }) => {
  await expect(page.getByText(/copied successfully/i)).toBeVisible({ timeout: 5_000 });
});

When(
  'a student opens the invite link and logs in as {string}',
  async ({ browser }, email: string) => {
    const user = Object.values(TEST_USERS).find((u) => u.email === email);
    if (!user) throw new Error(`Unknown test user: ${email}`);

    studentContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    studentPage = await studentContext.newPage();

    await studentPage.goto(inviteLink);
    await expect(studentPage).toHaveURL(/\/login/, { timeout: 15_000 });

    await expect(studentPage.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
    await studentPage.getByPlaceholder('you@domain.com').fill(user.email);
    await studentPage.getByPlaceholder('************').fill(user.password);
    await studentPage.getByRole('button', { name: /log\s*in/i }).first().click();

    await expect(studentPage).toHaveURL(/\/invite\/s\//, { timeout: 15_000 });
    await studentPage.getByRole('button', { name: /join course/i }).click();
  }
);

Then('the student should be enrolled and land on the LMS', async () => {
  if (studentPage) {
    await expect(studentPage).toHaveURL(/\/lms/, { timeout: 15_000 });
    await studentContext?.close();
    studentContext = null;
    studentPage = null;
  }
});
