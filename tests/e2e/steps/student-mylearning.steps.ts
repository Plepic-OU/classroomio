import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('I navigate to My Learning', async ({ page }) => {
  // Must use SPA navigation (sidebar link) — page.goto() triggers appSetup.ts
  // student redirect back to /lms. See student-enrollment.steps.ts for details.
  await page.getByRole('link', { name: 'My Learning' }).click();
  await page.waitForURL('**/lms/mylearning**');
});

Then('I should see {string} in my courses', async ({ page }, courseName: string) => {
  // Use heading role to avoid strict mode violation: getByText() matches both
  // the <h3> course title AND the truncated description <p> in the card.
  await expect(page.getByRole('heading', { name: courseName })).toBeVisible();
});
