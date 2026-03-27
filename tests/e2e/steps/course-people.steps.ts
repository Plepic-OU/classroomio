import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, Then } = createBdd();

Given('I am on the people page for course {string}', async ({ page }, courseTitle: string) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const res = await fetch(
    `http://localhost:54321/rest/v1/course?title=eq.${encodeURIComponent(courseTitle)}&select=id`,
    { headers },
  );
  const [course] = await res.json();
  await page.goto(`/courses/${course.id}`);
  await page.getByRole('button', { name: 'People' }).waitFor();
  await page.getByRole('button', { name: 'People' }).click();
  await page.waitForURL('**/people');
});

Then('I should see student {string} in the list', async ({ page }, studentName: string) => {
  // $group.people loads async after CourseContainer fetches from Supabase.
  // Use first() to avoid strict mode violations if the name appears in multiple
  // places, and allow up to 20s for data to load under full-suite load.
  await expect(page.getByText(studentName).first()).toBeVisible({ timeout: 20_000 });
});

Then('I should see {string} in the waitlist section', async ({ page }, studentName: string) => {
  // The waitlist section renders below the main people list and loads via
  // fetchWaitlistedMembers() after $group.id is available. Wait for the
  // section heading ("Waitlist (N)") to appear first, then check the name.
  await expect(page.getByText(/^Waitlist \(\d+\)/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(studentName).first()).toBeVisible({ timeout: 10_000 });
});
