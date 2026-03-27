import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { When, Then } = createBdd(test);

When('I navigate to the course settings', async ({ adminPage }) => {
  // After course creation, the modal redirects to /courses/{courseId}.
  // Wait for that redirect before appending /settings.
  await adminPage.waitForURL(/\/courses\/[^/]+$/, { timeout: 15_000 });
  const courseUrl = adminPage.url();
  await adminPage.goto(`${courseUrl}/settings`);
  await adminPage.waitForURL('**/settings**');
});

When('I toggle the publish switch', async ({ adminPage }) => {
  // CourseContainer renders Settings only after the course data is fetched (isFetching gate).
  // Wait for "Course Details" section to confirm settings are rendered.
  await adminPage.getByText('Course Details').waitFor({ timeout: 15_000 });
  // The publish toggle is the last Carbon Toggle on the settings page.
  // Carbon Toggle renders as input[type="checkbox"] with a styled label overlay — use force:true.
  // Scroll into view via the label text before clicking.
  const publishToggle = adminPage.locator('.bx--toggle-input').last();
  await publishToggle.scrollIntoViewIfNeeded();
  await publishToggle.click({ force: true });
});

When('I save the course settings', async ({ adminPage }) => {
  // The settings page has a Save button at the bottom. Use last() to resolve ambiguity
  // with any other Save buttons (e.g., UnsavedChanges component).
  const saveBtn = adminPage.getByRole('button', { name: /save changes/i });
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  // Wait for the success snackbar ("Course settings saved")
  await adminPage.waitForSelector('text=saved', { timeout: 10_000 });
});

Then('the course should be marked as published', async ({ adminPage }) => {
  // The toggle label changes from "Unpublished" to "Published" after toggling
  await adminPage.waitForSelector('text=Published', { timeout: 5_000 });
});
