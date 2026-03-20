import { test as base } from 'playwright-bdd';
import { request as baseRequest } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { CoursePage } from './pages/CoursePage';

async function resetTestData() {
  const ctx = await baseRequest.newContext({
    baseURL: process.env.PUBLIC_SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
  });

  // 1. Find test course IDs so we can cascade-delete FK-referencing tables first.
  const coursesRes = await ctx.get('/rest/v1/course?title=like.%5BTEST%5D%25&select=id', {
    headers: { Prefer: 'return=representation' },
  });
  const courses: Array<{ id: string }> = await coursesRes.json();

  for (const { id } of courses) {
    // Delete related rows (order matters: FK children before parents)
    await ctx.delete(`/rest/v1/course_newsfeed?course_id=eq.${id}`);
    await ctx.delete(`/rest/v1/organizationmember?course_id=eq.${id}`);
  }

  // 2. Delete the courses themselves
  await ctx.delete('/rest/v1/course?title=like.%5BTEST%5D%25');

  await ctx.dispose();
}

export const test = base.extend<
  { loginPage: LoginPage; coursePage: CoursePage },
  { resetData: void }
>({
  // Worker-scoped fixture: runs once per worker before any tests, auto-injected
  resetData: [
    async ({}, use) => {
      await resetTestData();
      await use();
    },
    { scope: 'worker', auto: true },
  ],
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  coursePage: async ({ page }, use) => use(new CoursePage(page)),
});
