import { Given, When, Then } from '../../fixtures';
import { createCourseFixture } from '../../helpers/course-fixture';

Given('a published course exists for enrollment', async ({ ctx }) => {
  const { courseId } = await createCourseFixture();
  ctx.courseId = courseId;
});

When('I click learn more on the available course', async ({ page }) => {
  // "Learn more" button label from translation: courses.course_card.learn_more
  // The explore page shows skeletons while loading — wait up to 30s for the button to appear
  await page.getByRole('button', { name: /learn more/i }).first().click({ timeout: 30_000 });
  await page.waitForURL(/\/course\//);
});

When('I click the enroll now button', async ({ page }) => {
  // "Enroll Now" label from translation: course.navItem.landing_page.pricing_section.enroll
  await page.getByRole('button', { name: /enroll now/i }).click();
  await page.waitForURL(/\/invite\/s\//);
});

When('I confirm joining the course', async ({ page }) => {
  // "Join Course" button on /invite/s/[hash] page
  await page.getByRole('button', { name: /join course/i }).click();
});

Then('I should be enrolled in the course', async ({ page }) => {
  // After joining, student is redirected to the LMS course view or back to /lms
  await page.waitForURL(/\/(lms|course)\//);
});
