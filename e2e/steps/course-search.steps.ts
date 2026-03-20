import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

Given('I navigate to the courses page', async ({ page }) => {
  // After login, we're on /org/[slug]. Click courses nav link.
  await page.getByRole('link', { name: 'Courses' }).click();
  await expect(page).toHaveURL(/\/courses/);
});

When('I search for {string}', async ({ page }, searchText: string) => {
  // Carbon Search component renders an <input type="search">
  const searchInput = page.getByRole('searchbox');
  await searchInput.fill(searchText);
});

Then(
  'I should see {string} in the course list',
  async ({ page }, courseTitle: string) => {
    await expect(page.getByText(courseTitle).first()).toBeVisible();
  }
);

Then(
  'I should not see {string} in the course list',
  async ({ page }, courseTitle: string) => {
    await expect(page.getByText(courseTitle)).toBeHidden();
  }
);
