import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

Given(
  'I am on the settings page for course {string} with enrollment reset',
  async ({ page }, courseTitle: string) => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    };
    const res = await fetch(
      `http://localhost:54321/rest/v1/course?title=eq.${encodeURIComponent(courseTitle)}&select=id`,
      { headers }
    );
    const [course] = await res.json();
    await fetch(`http://localhost:54321/rest/v1/course?id=eq.${course.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ max_capacity: null, waitlist_enabled: false })
    });
    await page.goto(`/courses/${course.id}`);
    await page.getByRole('button', { name: 'Settings' }).waitFor();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForURL('**/settings');
    await expect(
      page.locator('input[placeholder="Write the course title here"]')
    ).not.toHaveValue('');
  }
);

When('I enter {string} in the max capacity field', async ({ page }, value: string) => {
  const input = page.locator('input[placeholder="Unlimited"]');
  await input.waitFor();
  await input.fill(value);
});

Given('I am on the settings page for course {string}', async ({ page }, courseTitle: string) => {
  // Look up the course by title. anon key is blocked by RLS — use service role key.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const res = await fetch(
    `http://localhost:54321/rest/v1/course?title=eq.${encodeURIComponent(courseTitle)}&select=id,is_published`,
    { headers },
  );
  const [course] = await res.json();
  // Ensure the course starts unpublished so the test can verify publishing it.
  // "Modern Web Development with React" is published by default in seed data.
  if (course.is_published) {
    await fetch(
      `http://localhost:54321/rest/v1/course?id=eq.${course.id}`,
      { method: 'PATCH', headers, body: JSON.stringify({ is_published: false }) },
    );
  }
  // Navigate to course main page first — CourseContainer fetches $course into the store.
  // Direct navigation to /settings leaves course_title empty → save validation fails.
  await page.goto(`/courses/${course.id}`);
  await page.getByRole('button', { name: 'Settings' }).waitFor();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForURL('**/settings');
  await expect(page.locator('input[placeholder="Write the course title here"]')).not.toHaveValue('');
});

When('I enable the {string} toggle', async ({ page }, sectionTitle: string) => {
  // Carbon Toggle renders as <input role="switch" type="checkbox"> inside a .bx--row.
  // All toggles share the same aria-label ("Toggle"), so we filter by the section title
  // text in the same row to target the right one.
  // Wait for the section heading to be visible first — settings data loads async.
  // Wait for the section heading — settings load async from Supabase.
  await page.getByText(sectionTitle, { exact: true }).waitFor();
  // Carbon Toggle: the <input role="switch"> is visually hidden (1x1px, clipped).
  // Must click the <label class="bx--toggle-input__label"> which is the visible element.
  // Filter by the row that contains the section title to target the right toggle.
  const row = page.locator('.bx--row').filter({ hasText: sectionTitle });
  await row.locator('label.bx--toggle-input__label').click();
});

Then('I should see a success notification {string}', async ({ page }, message: string) => {
  // Carbon InlineNotification renders with role="alert" but there is also a persistent
  // DnD aria-alert (id="dnd-action-aria-alert") always in the DOM — filter by text.
  await expect(page.locator('[role="alert"]').filter({ hasText: message })).toBeVisible();
});
