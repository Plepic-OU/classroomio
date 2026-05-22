import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

const TEST_COURSE_ID = '00000000-bdd1-0000-0000-000000000002';

When('I navigate to the marks page for the test course', async ({ page }) => {
  // Navigate to lessons first so the profile/org debounce fires (1 s) and
  // RoleBasedSecurity on the marks page won't redirect before profile is ready.
  await page.goto(`/courses/${TEST_COURSE_ID}/lessons`);
  await page.waitForLoadState('domcontentloaded');
  // The Add button is inside RoleBasedSecurity([1,2]); it only shows once both
  // fetchCourseFromAPI has returned ($group.people set) AND $profile.id is set.
  await page.getByRole('button', { name: /^add$/i }).waitFor({ timeout: 10_000 });
  // Click Marks nav button — client-side SvelteKit navigation preserves stores.
  await page.getByRole('button', { name: 'Marks' }).click();
  await page.waitForLoadState('domcontentloaded');
});

Then('I should see the marks heading', async ({ page }) => {
  await page.getByRole('heading', { name: 'Marks' }).waitFor({ timeout: 10_000 });
});
