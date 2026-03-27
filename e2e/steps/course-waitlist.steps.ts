import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';

const { When, Then } = createBdd(test);

// ── Seed constants ─────────────────────────────────────────────────────────
//
// Course A (e2e00000-...-000006): full course, student NOT pre-seeded on waitlist.
// Invite hash: base64(JSON.stringify({id, name, description, orgSiteName})).
// Compute: btoa(JSON.stringify({id:'e2e00000-0000-0000-0000-000000000006',
//   name:'E2E Full Course',description:'A full course for waitlist E2E testing',
//   orgSiteName:'udemy-test'}))
const FULL_COURSE_INVITE_HASH =
  'eyJpZCI6ImUyZTAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwNiIsIm5hbWUiOiJFMkUgRnVsbCBDb3Vyc2UiLCJkZXNjcmlwdGlvbiI6IkEgZnVsbCBjb3Vyc2UgZm9yIHdhaXRsaXN0IEUyRSB0ZXN0aW5nIiwib3JnU2l0ZU5hbWUiOiJ1ZGVteS10ZXN0In0%3D';

// Course B (e2e00000-...-000008): full course, test student pre-seeded on waitlist.
const ADMIN_WAITLIST_COURSE_ID = 'e2e00000-0000-0000-0000-000000000008';

// Course C claim tokens (seeded in reset_test_data):
// Valid: 'waiting' entry for test student, expires_at NULL.
const VALID_CLAIM_TOKEN = 'e2ecafe0-0000-4000-a000-000000000001';
// Expired: 'notified' entry for admin, expires_at in 2020.
const EXPIRED_CLAIM_TOKEN = 'e2ecafe0-0000-4000-a000-000000000002';

// ── Student step definitions ───────────────────────────────────────────────

When('I navigate to the full course invite page', async ({ studentPage }) => {
  await studentPage.goto(`/invite/s/${FULL_COURSE_INVITE_HASH}`);
  // Wait for SvelteKit hydration: the course title confirms the layout load() decoded the hash.
  await studentPage.getByText('E2E Full Course').waitFor({ timeout: 10_000 });
  // Give onMount time to finish the async getStudentWaitlistEntry check
  // (sets onWaitlist/courseFull if the student is already queued).
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await studentPage.waitForTimeout(2000);
});

When('I attempt to join the full course', async ({ studentPage }) => {
  // The Join Course button is disabled while $profile.id is loading.
  // Wait for it to become enabled before clicking.
  await studentPage.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10_000 });
  await studentPage.click('button[type="submit"]');
  // Wait for the full-course CTA to appear (addGroupMember returns {full:true})
  await studentPage.locator('[data-testid="course-full-message"]').waitFor({ timeout: 15_000 });
});

Then('I should see the course full message', async ({ studentPage }) => {
  await studentPage.locator('[data-testid="course-full-message"]').waitFor({ timeout: 10_000 });
});

Then('I should see the join waitlist button', async ({ studentPage }) => {
  await studentPage.locator('[data-testid="join-waitlist-btn"]').waitFor({ timeout: 10_000 });
});

When('I click the join waitlist button', async ({ studentPage }) => {
  await studentPage.locator('[data-testid="join-waitlist-btn"]').waitFor({ timeout: 10_000 });
  await studentPage.locator('[data-testid="join-waitlist-btn"]').click();
});

Then('I should see the waitlist confirmation message', async ({ studentPage }) => {
  await studentPage.locator('[data-testid="waitlist-success-message"]').waitFor({ timeout: 10_000 });
});

Then('I should see the leave waitlist button', async ({ studentPage }) => {
  await studentPage.locator('[data-testid="leave-waitlist-btn"]').waitFor({ timeout: 10_000 });
});

When('I click the leave waitlist button', async ({ studentPage }) => {
  await studentPage.locator('[data-testid="leave-waitlist-btn"]').click();
});

When('I navigate to the valid waitlist claim link', async ({ studentPage }) => {
  await studentPage.goto(`/invite/claim/${VALID_CLAIM_TOKEN}`);
});

When('I navigate to the expired waitlist claim link', async ({ studentPage }) => {
  await studentPage.goto(`/invite/claim/${EXPIRED_CLAIM_TOKEN}`);
});

Then('I should see the claim expired message', async ({ studentPage }) => {
  await studentPage.locator('[data-testid="claim-expired-title"]').waitFor({ timeout: 10_000 });
});

// ── Admin step definitions ─────────────────────────────────────────────────

When('I navigate to the waitlisted course people page', async ({ adminPage }) => {
  await adminPage.goto(`/courses/${ADMIN_WAITLIST_COURSE_ID}/people`);
  await adminPage.waitForURL(`**/courses/${ADMIN_WAITLIST_COURSE_ID}/people**`, { timeout: 10_000 });
});

Then('I should see the waitlist section with 1 student', async ({ adminPage }) => {
  const section = adminPage.locator('[data-testid="waitlist-section"]');
  await section.waitFor({ timeout: 15_000 });
  // Header includes the count — "Waiting List (1)"
  const header = adminPage.locator('[data-testid="waitlist-section-header"]');
  await expect(header).toContainText('1');
});

When('I remove the first student from the waitlist', async ({ adminPage }) => {
  const section = adminPage.locator('[data-testid="waitlist-section"]');
  await section.waitFor({ timeout: 15_000 });
  const removeBtn = section.locator('[data-testid="remove-from-waitlist-btn"]').first();
  await removeBtn.click();
});

Then('the waitlist section should be empty', async ({ adminPage }) => {
  // After removing the last entry, the waitlist section is hidden (only renders when length > 0)
  await expect(adminPage.locator('[data-testid="waitlist-section"]')).toBeHidden({ timeout: 10_000 });
});
