import { createBdd } from 'playwright-bdd';
import { removeEnrollment } from '../../helpers/enrollment';

const { Given, When, Then } = createBdd();

Given('the student is not enrolled in {string}', async ({}, courseTitle: string) => {
  removeEnrollment('student@test.com', courseTitle);
});

When('I click on the course {string}', async ({ page }, courseTitle: string) => {
  const heading = page.locator('h3', { hasText: courseTitle }).first();
  await heading.waitFor({ state: 'visible', timeout: 10000 });
  await heading.click();
  await page.waitForURL(/\/course\//, { timeout: 15000 });
});

When('I click the enroll button', async ({ page }) => {
  await page.getByRole('button', { name: /enroll/i }).first().click();
});

When('I click the join course button', async ({ page }) => {
  await page.getByRole('button', { name: /join course/i }).click();
});

Then('I should be redirected to the LMS dashboard', async ({ page }) => {
  await page.waitForURL(/\/lms/, { timeout: 15000 });
});
