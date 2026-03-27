import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

Given('I am logged in as a student', async ({ studentPage }) => {
  // No-op: storageState from student-authenticated project provides the session
});

When('I navigate to the course explore page', async ({ studentPage }) => {
  // Hard-navigating directly to /lms/explore triggers getProfile's unconditional student
  // redirect: goto('/lms') fires ~400ms after currentOrg loads. Workaround:
  // 1. Hard-nav to /lms — the auth redirect fires here (same-route, no visible change)
  // 2. Wait for the org name in the header — this means getOrganizations() completed and
  //    goto('/lms') is about to fire (or has fired). Wait an extra 1000ms for it to settle.
  // 3. Only then click Explore (client-side nav) — profile is in store, no more redirects.
  await studentPage.goto('/lms');
  await studentPage.waitForURL('**/lms**');
  // Wait for org header — confirms currentOrg store is populated (just before redirect fires)
  await studentPage.locator('header, nav').getByText('Udemy Test').waitFor({ timeout: 10_000 });
  // Wait for the getProfile goto('/lms') redirect to complete (~400ms after org loads)
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await studentPage.waitForTimeout(1000);
  // Now click Explore — profile is in store, getProfile will early-return, no redirect
  await studentPage.getByRole('link', { name: /explore/i }).click();
  await studentPage.waitForURL('**/lms/explore**');
});

When('I click on the {string} course card', async ({ studentPage }, courseName: string) => {
  // Confirm we're on the explore page before looking for cards
  await studentPage.waitForURL('**/lms/explore**', { timeout: 5_000 });
  // Wait for courses to load (fetchExploreCourses is async and requires $profile.id + $currentOrg.id)
  await studentPage
    .getByRole('button')
    .filter({ hasText: courseName })
    .waitFor({ timeout: 10_000 });
  await studentPage.getByRole('button').filter({ hasText: courseName }).first().click();
  await studentPage.waitForURL('**/course/**');
});

When('I click the {string} button', async ({ studentPage }, buttonLabel: string) => {
  await studentPage
    .getByRole('button', { name: new RegExp(buttonLabel, 'i') })
    .first()
    .click();
});

Then('I should be redirected to the LMS dashboard', async ({ studentPage }) => {
  await studentPage.waitForURL('**/lms**', { timeout: 15_000 });
});

When('I navigate to My Learning', async ({ studentPage }) => {
  // Same race-condition workaround as explore: wait for org header + 1000ms before
  // doing client-side navigation, to let getProfile's goto('/lms') complete first.
  await studentPage.goto('/lms');
  await studentPage.waitForURL('**/lms**');
  await studentPage.locator('header, nav').getByText('Udemy Test').waitFor({ timeout: 10_000 });
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await studentPage.waitForTimeout(1000);
  await studentPage.getByRole('link', { name: /my learning/i }).click();
  await studentPage.waitForURL('**/lms/mylearning**');
});

Then('I should see {string} in my learning list', async ({ studentPage }, courseName: string) => {
  // Courses with 0 lessons have progress_rate === total_lessons (0 === 0) so they land
  // in the "Complete" tab. The Tabs component renders tabs as <button> elements (not role=tab).
  await studentPage.getByRole('button', { name: /^complete/i }).click();
  await studentPage
    .getByRole('button')
    .filter({ hasText: courseName })
    .waitFor({ timeout: 10_000 });
});
