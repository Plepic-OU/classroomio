import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures';

const { Given, When, Then } = createBdd(test);

// Seed data: course "Getting started with MVC" in org "Udemy Test" (siteName: "udemy-test")
const SEED_COURSES: Record<string, { id: string; description: string }> = {
  'Getting started with MVC': {
    id: '98e6e798-f0bd-4f9d-a6f5-ce0816a4f97e',
    description:
      'Embark on a comprehensive journey into the world of Model-View-Controller (MVC) architecture'
  },
  'Modern Web Development with React': {
    id: '16e3bc8d-5d1b-4708-988e-93abae288ccf',
    description:
      "By the end of this course, you'll be equipped to build interactive and responsive web applications"
  }
};

function buildInviteLink(courseName: string): string {
  const course = SEED_COURSES[courseName];
  if (!course) throw new Error(`Unknown seed course: ${courseName}`);

  const hash = encodeURIComponent(
    btoa(
      JSON.stringify({
        id: course.id,
        name: courseName,
        description: course.description,
        orgSiteName: 'udemy-test'
      })
    )
  );
  return `/invite/s/${hash}`;
}

When(
  'I navigate to the student invite link for course {string}',
  async ({ page }, courseName: string) => {
    const link = buildInviteLink(courseName);
    await page.goto(link);
    // Wait for the invite page to load and show the course name
    await expect(page.getByText(courseName)).toBeVisible({ timeout: 10000 });
  }
);

When('I click the join course button', async ({ page }) => {
  const joinButton = page.getByRole('button', { name: /join course/i });
  await expect(joinButton).toBeEnabled({ timeout: 10000 });
  await joinButton.click();
});

Then('I should be redirected to the LMS dashboard', async ({ page }) => {
  await expect(page).toHaveURL(/\/lms/, { timeout: 15000 });
});
