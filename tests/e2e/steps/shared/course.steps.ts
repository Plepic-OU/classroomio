import { createBdd } from 'playwright-bdd';

const { Given } = createBdd();

Given('I have a new course named {string}', async ({ page }, title: string) => {
  await page.getByRole('link', { name: /courses/i }).click();
  await page.waitForURL(/\/courses/);
  await page.getByRole('button', { name: /create course/i }).click();
  await page.getByRole('button', { name: /next/i }).click();
  await page.getByPlaceholder(/course name/i).fill(title);
  await page.getByPlaceholder(/a little description/i).fill('BDD test description');
  await page.getByRole('button', { name: /finish/i }).click();
  await page.waitForURL(/\/courses\/[^/]+$/, { timeout: 15_000 });
});

Given('I navigate to the {string} tab of this course', async ({ page }, tab: string) => {
  const courseId = page.url().match(/\/courses\/([^/?#]+)/)?.[1] ?? '';
  await page.goto(`/courses/${courseId}/${tab.toLowerCase()}`);
  await page.waitForLoadState('networkidle');
});
