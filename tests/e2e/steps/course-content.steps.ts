import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

Given('I am on the content page for course {string}', async ({ page }, courseTitle: string) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const res = await fetch(
    `http://localhost:54321/rest/v1/course?title=eq.${encodeURIComponent(courseTitle)}&select=id`,
    { headers },
  );
  const [course] = await res.json();
  // Navigate to course main page first so $course store populates before clicking nav
  await page.goto(`/courses/${course.id}`);
  await page.getByRole('button', { name: 'Content' }).waitFor();
  await page.getByRole('button', { name: 'Content' }).click();
  await page.waitForURL('**/lessons');
});

When('I fill in the lesson title {string}', async ({ page }, title: string) => {
  // The "Add New Lesson" modal uses the custom Modal component (class="dialog"),
  // NOT Carbon's bx--modal. The title TextField uses a <p> label (not ARIA-linked),
  // so we locate the input by its containing .dialog element.
  // autoFocus=true focuses the input on open, but filling by locator is more explicit.
  const modal = page.locator('.dialog').filter({ hasText: 'Add New Lesson' });
  await modal.waitFor();
  await modal.locator('input').fill(title);
});

Then('I should be on the lesson page', async ({ page }) => {
  // After saving, the modal calls goto('/courses/${id}/lessons/${lessonId}')
  await page.waitForURL('**/lessons/**');
});
