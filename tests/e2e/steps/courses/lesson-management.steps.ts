import { Given, When, Then } from '../../fixtures';
import { createCourseFixture } from '../../helpers/course-fixture';

Given('a course exists', async ({ ctx }) => {
  const { courseId } = await createCourseFixture();
  ctx.courseId = courseId;
});

Given('I am on the lessons page for that course', async ({ page, ctx }) => {
  await page.goto(`/courses/${ctx.courseId}/lessons`);
  await page.waitForSelector('aside', { state: 'visible' });
  // Default store has version=V2; wait for course data to load (V1 shows "Enable Sections" btn)
  await page.getByRole('button', { name: /enable sections/i }).waitFor({ timeout: 30_000 });
});

When('I click the add lesson button', async ({ page }) => {
  // "Add" button label from translation: course.navItem.lessons.add_lesson.button_title
  await page.getByRole('button', { name: /^add$/i }).click();
});

When('I enter the lesson title {string}', async ({ page }, title: string) => {
  // TextField renders a <p> label, not a <label> — use getByPlaceholder or getByLabel
  // TODO: verify selector — label is "Lesson Title" from translation
  await page.getByLabel(/lesson title/i).fill(title);
});

When('I save the new lesson', async ({ page }) => {
  // Save button label from translation: course.navItem.lessons.add_lesson.save
  await page.getByRole('button', { name: /^save$/i }).click();
});

Then('{string} should appear in the lesson list', async ({ page }, title: string) => {
  // Lesson title appears in both the sidebar and page body — use first() to avoid strict mode violation
  await page.getByText(title).first().waitFor();
});
