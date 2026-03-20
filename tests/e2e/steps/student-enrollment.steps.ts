import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { getEnrollableCourse } from '../helpers/supabase';

const { Given, When, Then } = createBdd(test);

Given('I am on the join page for a free enrollable course', async ({ studentEnrollmentPage }) => {
  const course = await getEnrollableCourse();
  await studentEnrollmentPage.gotoInvitePage(
    course.id,
    course.title,
    course.description,
    course.orgSiteName
  );
});

When('I confirm joining the course', async ({ studentEnrollmentPage }) => {
  await studentEnrollmentPage.confirmJoin();
});

Then('I should be taken to the student dashboard', async ({ studentEnrollmentPage }) => {
  await studentEnrollmentPage.expectStudentDashboard();
});
