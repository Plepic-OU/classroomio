import { Given, When, Then } from '../fixtures';
import { expect } from '@playwright/test';

Given('I am on the course lessons page', async ({ page }) => {
  const courseId = page.url().match(/\/courses\/([^/]+)$/)?.[1];
  await page.goto(`/courses/${courseId}/lessons`);
  await expect(page).toHaveURL(/\/lessons$/, { timeout: 15_000 });
});

// V2 courses (the only kind NewCourseModal creates) require a section before lessons.
// The toolbar "Add" button opens the "Add New Section" modal.
When('I add a section titled {string}', async ({ page }, title: string) => {
  await page.getByRole('button', { name: /^add$/i }).click();
  await expect(page.getByText(/add new section/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('textbox', { name: /section title/i }).fill(title);
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
});

// Each section row has an icon-only Add IconButton (size="small" → button.root.small).
// After save the page navigates to /courses/[id]/lessons/[lessonId].
When('I add a lesson titled {string} to the section', async ({ page }, title: string) => {
  await page.locator('button.root.small').first().click();
  await expect(page.getByText(/add new lesson/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('textbox', { name: /lesson title/i }).fill(title);
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page).toHaveURL(/\/lessons\/[^/]+$/, { timeout: 15_000 });
});

When('I return to the lessons list', async ({ page }) => {
  const lessonsListUrl = page.url().replace(/\/lessons\/[^/]+$/, '/lessons');
  await page.goto(lessonsListUrl);
  await expect(page).toHaveURL(/\/lessons$/, { timeout: 15_000 });
});

When('I open the lesson exercises', async ({ page }) => {
  await page.goto(page.url() + '/exercises');
  await expect(page).toHaveURL(/\/exercises$/, { timeout: 15_000 });
});

Then('I should see the lesson in the list', async ({ page }) => {
  await expect(page.getByText('BDD Lesson One')).toBeVisible({ timeout: 10_000 });
});

// Sections AND lessons each render a Carbon OverflowMenu. Section's is size="xl",
// lesson's is size="sm". The lesson row is below the section, so target the LAST
// overflow trigger on the page.
When('I delete the lesson', async ({ page }) => {
  const menus = page.getByRole('button', { name: /open and close list of options|options|overflow/i });
  await menus.last().click();
  await page.getByRole('menuitem', { name: /^delete$/i }).click();
  await page.getByRole('button', { name: /^yes$/i }).click();
});

Then('the lesson should be removed from the list', async ({ page }) => {
  await expect(page.getByText('BDD Lesson One')).not.toBeVisible({ timeout: 10_000 });
});
