import { createBdd } from 'playwright-bdd';
import { request } from '@playwright/test';
import { test } from '../fixtures';

const { Given, When, Then } = createBdd(test);

async function getOrgSlug(): Promise<string> {
  // Query Supabase directly to resolve the org siteName for the test user.
  // This avoids slow browser-side auth redirect detection.
  const ctx = await request.newContext({
    baseURL: process.env.PUBLIC_SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  // Get the first org the test user belongs to via organizationmember join
  const res = await ctx.get(
    '/rest/v1/organizationmember?select=organization(site_name)&limit=1&order=id.asc',
    {
      headers: {
        'Content-Profile': 'public',
        Accept: 'application/json',
      },
    }
  );
  const data = await res.json();
  await ctx.dispose();
  return data[0]?.organization?.site_name as string;
}

Given('I am on the courses page', async ({ page }) => {
  const slug = await getOrgSlug();
  await page.goto(`/org/${slug}/courses`);
});

When('I open the create course modal', async ({ coursePage }) => {
  await coursePage.openCreateModal();
});

When('I select the course type {string}', async ({ coursePage }, type: string) => {
  await coursePage.selectCourseType(type);
});

When(
  'I fill in the title {string} and description {string}',
  async ({ coursePage }, title: string, description: string) => {
    await coursePage.fillDetails(title, description);
  }
);

When('I submit the form', async ({ coursePage }) => {
  await coursePage.submit();
});

Then(
  'the course {string} should be visible in the list',
  async ({ coursePage }, title: string) => {
    await coursePage.expectCourseVisible(title);
  }
);
