import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

// Seeded course IDs from supabase/seed.sql
const COURSE_IDS: Record<string, string> = {
  'Data Science with Python and Pandas': 'f0a85d18-aff4-412f-b8e6-3b34ef098dce',
  'Modern Web Development with React': '16e3bc8d-5d1b-4708-988e-93abae288ccf'
};

Given('I am on the people page for course {string}', async ({ page }, courseName: string) => {
  const courseId = COURSE_IDS[courseName];
  await page.goto(`/courses/${courseId}/people`);
  await page.waitForURL(`/courses/${courseId}/people`);
});

Then('I should see members listed in the table', async ({ page }) => {
  // The people list shows profile.fullname. Admin's fullname is "Elon Gates" (seeded).
  await expect(page.getByText('Elon Gates').first()).toBeVisible();
});

When('I search for {string}', async ({ page }, query: string) => {
  // Carbon's Search component renders an <input type="search">
  await page.getByRole('searchbox').fill(query);
});

Then('I should see {string} in the people list', async ({ page }, name: string) => {
  await expect(page.getByText(name).first()).toBeVisible();
});
