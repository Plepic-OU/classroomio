import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then, After } = createBdd();

When('I navigate to the courses page', async ({ page }) => {
  // Navigate via the sidebar nav link — avoids hard-coding the org slug
  await page.getByRole('link', { name: 'Courses' }).click();
  await page.waitForURL('**/org/**/courses');
});

When('I click the {string} button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('I select a course type', async ({ page }) => {
  // Modal step 0: the first type (Live Class) is pre-selected; just advance to step 1
  // Wait for modal to render after URL change (?create=true) before clicking
  await page.waitForURL('**?create=true');
  await page.getByRole('button', { name: 'Next' }).click();
});

When('I fill in the course name {string}', async ({ page }, name: string) => {
  await page.locator('input[placeholder="Your course name"]').fill(name);
});

When('I fill in the course description {string}', async ({ page }, description: string) => {
  await page.locator('textarea[placeholder]').first().fill(description);
});

When('I submit the form', async ({ page }) => {
  await page.getByRole('button', { name: 'Finish' }).click();
});

Then('I should see {string} on the page', async ({ page }, name: string) => {
  await page.waitForURL('**/courses/**');
  await expect(page.getByText(name)).toBeVisible();
});

// Cleanup: delete courses created during the scenario to avoid accumulation
After(async () => {
  // Uses local Supabase REST API — anon key from `supabase start` output
  const supabaseUrl = 'http://localhost:54321';
  const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
  await fetch(`${supabaseUrl}/rest/v1/course?title=eq.Test Course`, {
    method: 'DELETE',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
  });
});
