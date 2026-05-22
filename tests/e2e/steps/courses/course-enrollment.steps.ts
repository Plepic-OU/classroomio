import { createBdd } from 'playwright-bdd';
import { loginAsStudent } from '../../helpers/login';

const { Given, When, Then } = createBdd();

Given('I am logged in as student {string}', async ({ page }, email: string) => {
  await loginAsStudent(page, email);
});

When('I navigate to the explore page', async ({ page }) => {
  await page.goto('/lms/explore');
  await page.waitForLoadState('domcontentloaded');
});

Then('I should see {string} in the course list', async ({ page }, courseName: string) => {
  await page.getByText(courseName).waitFor({ timeout: 10_000 });
});

Then('I should see the explore courses heading', async ({ page }) => {
  await page.getByRole('heading', { name: 'Explore our courses' }).waitFor({ timeout: 10_000 });
});
