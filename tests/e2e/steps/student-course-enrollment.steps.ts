import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

// Seeded course data from supabase/seed.sql
// These courses are available in the Udemy Test org (site name: udemy-test)
const COURSE_INVITE_DATA: Record<string, { id: string; name: string; description: string; orgSiteName: string }> = {
  'Modern Web Development with React': {
    id: '16e3bc8d-5d1b-4708-988e-93abae288ccf',
    name: 'Modern Web Development with React',
    description:
      "By the end of this course, you'll be equipped to build interactive and responsive web applications, making you a proficient React developer ready for the demands of today's web development landscape.",
    orgSiteName: 'udemy-test'
  }
};

function buildInviteHash(courseData: { id: string; name: string; description: string; orgSiteName: string }): string {
  return Buffer.from(JSON.stringify(courseData)).toString('base64');
}

Given('I navigate to the invite link for course {string}', async ({ page }, courseName: string) => {
  const courseData = COURSE_INVITE_DATA[courseName];
  const hash = buildInviteHash(courseData);
  await page.goto(`/invite/s/${hash}`);
  // Invite page redirects unauthenticated users to login
  await page.waitForURL(/\/login/);
});

Then('I should be on the login page with a redirect param', async ({ page }) => {
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

When('I click the {string} link', async ({ page }, linkText: string) => {
  await page.getByRole('link', { name: linkText }).click();
});


Then('I should be on the signup page', async ({ page }) => {
  await page.waitForURL(/\/signup/);
  await expect(page).toHaveURL(/\/signup/);
});

When('I fill in the signup form with email {string} and password {string}', async ({ page }, email: string, password: string) => {
  await page.fill('[type=email]', email);
  // Two password fields: first is password, second is confirm password
  await page.locator('[type=password]').nth(0).fill(password);
  await page.locator('[type=password]').nth(1).fill(password);
});

When('I submit the signup form', async ({ page }) => {
  await page.getByRole('button', { name: 'Create Account' }).click();
});

Then('I should be redirected back to the invite page', async ({ page }) => {
  await page.waitForURL(/\/invite\/s\//);
  await expect(page).toHaveURL(/\/invite\/s\//);
});

Then('I should be redirected to the LMS', async ({ page }) => {
  await page.waitForURL(/\/lms/);
  await expect(page).toHaveURL(/\/lms/);
});
