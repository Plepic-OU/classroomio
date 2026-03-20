import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import {
  createWaitlistTestCourse,
  getStudentProfileId,
  seedActiveMember,
  seedWaitlistedMember,
} from '../helpers/supabase';

const { Given, When, Then } = createBdd(test);

// ── Scenario: Settings page shows waitlist fields ────────────────────────────

let settingsCourseId: string;

Given('there is a course with waitlist already enabled', async () => {
  const course = await createWaitlistTestCourse('[TEST] Waitlist Settings Course', 5);
  settingsCourseId = course.id;
});

When('I navigate to the settings page for that course', async ({ courseSettingsPage }) => {
  await courseSettingsPage.gotoSettings(settingsCourseId);
});

Then('the max capacity field should be visible', async ({ courseSettingsPage }) => {
  await courseSettingsPage.expectWaitlistEnabled();
});

// ── Scenario: Student sees Join Waiting List button ──────────────────────────

let fullCourse: { id: string; groupId: string; title: string; description: string; orgSiteName: string };

Given('there is a published full waitlist course', async () => {
  const studentProfileId = await getStudentProfileId();
  // max_capacity=1; we seed one active student to fill the slot
  fullCourse = await createWaitlistTestCourse('[TEST] Full Waitlist Course', 1);
  await seedActiveMember(fullCourse.groupId, studentProfileId);
});

When('I am on the join page for that course', async ({ studentEnrollmentPage }) => {
  await studentEnrollmentPage.gotoInvitePage(
    fullCourse.id,
    fullCourse.title,
    fullCourse.description,
    fullCourse.orgSiteName,
  );
});

Then('I should see the "Join Waiting List" button', async ({ page }) => {
  await page.getByRole('button', { name: 'Join Waiting List' }).waitFor();
});

// ── Scenario: Teacher sees Waiting List tab and approves ─────────────────────

let waitlistCourse: { id: string; groupId: string; title: string; description: string; orgSiteName: string };

Given('there is a waitlist course with a waitlisted student', async () => {
  const studentProfileId = await getStudentProfileId();
  waitlistCourse = await createWaitlistTestCourse('[TEST] Approve Waitlist Course', 10);
  await seedWaitlistedMember(waitlistCourse.groupId, studentProfileId);
});

When(
  'I navigate to the people page for that course',
  async ({ coursePeoplePage }) => {
    await coursePeoplePage.gotoPeople(waitlistCourse.id);
  },
);

When('I click the Waiting List tab', async ({ coursePeoplePage }) => {
  await coursePeoplePage.clickWaitlistTab();
});

Then('I should see the waiting list tab', async ({ coursePeoplePage }) => {
  await coursePeoplePage.expectWaitlistTabVisible();
});

When('I approve the first waitlisted student', async ({ coursePeoplePage }) => {
  await coursePeoplePage.approveFirst();
});

Then('the waiting list should be empty', async ({ coursePeoplePage }) => {
  await coursePeoplePage.expectWaitlistEmpty();
});
