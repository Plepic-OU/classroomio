import { Given, When, Then } from '../../fixtures';
import { createStudentEnrolledCourseFixture } from '../../helpers/course-fixture';

Given('I am enrolled in a course with lessons', async ({ ctx }) => {
  const { courseId, courseTitle } = await createStudentEnrolledCourseFixture();
  ctx.courseId = courseId;
  ctx.courseTitle = courseTitle;
});

Then('I should see the My Learning heading', async ({ page }) => {
  await page.getByRole('heading', { name: 'My Learning', level: 1 }).waitFor();
});

Then('I should see the In Progress tab', async ({ page }) => {
  await page.getByRole('button', { name: /in progress/i }).waitFor();
});

Then('I should see the Complete tab', async ({ page }) => {
  await page.getByRole('button', { name: /complete/i }).waitFor();
});

Then('I should see the course search box', async ({ page }) => {
  await page.getByPlaceholder('Search courses').waitFor();
});

Then('I should see the no in-progress courses message', async ({ page }) => {
  await page.getByText('No Course In progress').waitFor({ timeout: 15_000 });
});

Then('I should see the enrolled course in the In Progress tab', async ({ page, ctx }) => {
  await page.getByRole('heading', { name: ctx.courseTitle!, level: 3 }).waitFor({ timeout: 30_000 });
});

When('I click the Complete tab', async ({ page }) => {
  await page.getByRole('button', { name: /complete/i }).click();
});

Then('I should see the no completed courses message', async ({ page }) => {
  await page.getByText('No Course Completed').waitFor({ timeout: 15_000 });
});
