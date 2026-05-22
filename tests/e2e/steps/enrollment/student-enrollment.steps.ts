import { Given, When, Then } from '../../fixtures';

// Seeded course: "Getting started with MVC" — id from supabase/seed.sql
const SEEDED_COURSES: Record<string, { id: string; description: string; orgSiteName: string }> = {
  'Getting started with MVC': {
    id: '98e6e798-f0bd-4f9d-a6f5-ce0816a4f97e',
    description: 'Learn MVC architecture',
    orgSiteName: 'udemy-test',
  },
};

function buildInviteHash(name: string) {
  const course = SEEDED_COURSES[name];
  if (!course) throw new Error(`No seeded course found for: ${name}`);
  return encodeURIComponent(
    Buffer.from(JSON.stringify({ id: course.id, name, description: course.description, orgSiteName: course.orgSiteName })).toString('base64')
  );
}

Given('I follow the invite link for course {string}', async ({ page }, courseName: string) => {
  const hash = buildInviteHash(courseName);
  await page.goto(`/invite/s/${hash}`);
  await page.getByRole('heading', { name: courseName }).waitFor();
});

When('I click {string}', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

Then('I should land on the student dashboard', async ({ page }) => {
  await page.waitForURL(/\/(lms|courses)/);
});
