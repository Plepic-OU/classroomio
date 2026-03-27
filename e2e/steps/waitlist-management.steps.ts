import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When(
  'I navigate to people for course {string}',
  async ({ page }, courseTitle: string) => {
    // Navigate to courses page
    await page.getByRole('link', { name: 'Courses' }).click();
    await expect(page).toHaveURL(/\/courses/);

    // Click the course card
    await page.getByRole('heading', { name: courseTitle }).click();
    await expect(page).toHaveURL(/\/courses\/[a-f0-9-]+/);

    // Navigate to people tab
    await page.getByText('People').click();
    await expect(page).toHaveURL(/\/people/);
  }
);

Then('I should see the {string} tab', async ({ page }, tabName: string) => {
  await expect(page.getByRole('button', { name: tabName })).toBeVisible();
});

When('I click the {string} tab button', async ({ page }, tabName: string) => {
  await page.getByRole('button', { name: new RegExp(tabName) }).click();
});

Then('I should see waitlisted students', async ({ page }) => {
  await expect(page.getByText('John Doe')).toBeVisible();
});

Then('I should see enrolled students', async ({ page }) => {
  // The enrolled view shows the StructuredList with Name/Role/Action headers
  await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();
});
