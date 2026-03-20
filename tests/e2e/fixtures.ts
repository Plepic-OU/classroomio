import { test as base } from 'playwright-bdd';
import { request as baseRequest } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { CoursePage } from './pages/CoursePage';
import { StudentEnrollmentPage } from './pages/StudentEnrollmentPage';
import { LessonPage } from './pages/LessonPage';
import { CourseSettingsPage } from './pages/CourseSettingsPage';
import { MyLearningPage } from './pages/MyLearningPage';
import { OrgSettingsPage } from './pages/OrgSettingsPage';
import { CoursePeoplePage } from './pages/CoursePeoplePage';

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

  // 2. Delete [TEST] lessons
  await ctx.delete('/rest/v1/lesson?title=like.%5BTEST%5D%25');

  // 3. Delete the courses themselves
  await ctx.delete('/rest/v1/course?title=like.%5BTEST%5D%25');

  // 4. Clean up extra org memberships created by enrollment tests (admin enrolled as student).
  //    Get admin profile_id, then delete any student-role (role_id=3) org memberships they have.
  const adminProfileRes = await ctx.get(
    `/rest/v1/profile?email=eq.${encodeURIComponent(process.env.TEST_EMAIL!)}&select=id&limit=1`,
    { headers: { Prefer: 'return=representation' } }
  );
  const adminProfiles: Array<{ id: string }> = await adminProfileRes.json();
  if (adminProfiles[0]?.id) {
    await ctx.delete(
      `/rest/v1/organizationmember?profile_id=eq.${adminProfiles[0].id}&role_id=eq.3`
    );
    // Also delete any groupmember student records for the admin (from enrollment tests)
    await ctx.delete(
      `/rest/v1/groupmember?profile_id=eq.${adminProfiles[0].id}&role_id=eq.3`
    );
  }

  // 5. Clean up groupmember records for the seeded student account (student@test.com).
  //    Waitlist tests seed this user as active/waitlisted; must reset between runs.
  const studentProfileRes = await ctx.get(
    '/rest/v1/profile?email=eq.student%40test.com&select=id&limit=1',
    { headers: { Prefer: 'return=representation' } }
  );
  const studentProfiles: Array<{ id: string }> = await studentProfileRes.json();
  if (studentProfiles[0]?.id) {
    await ctx.delete(`/rest/v1/groupmember?profile_id=eq.${studentProfiles[0].id}&role_id=eq.3`);
  }

  await ctx.dispose();
}

export const test = base.extend<
  { loginPage: LoginPage; coursePage: CoursePage; studentEnrollmentPage: StudentEnrollmentPage; lessonPage: LessonPage; courseSettingsPage: CourseSettingsPage; myLearningPage: MyLearningPage; orgSettingsPage: OrgSettingsPage; coursePeoplePage: CoursePeoplePage },
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
  studentEnrollmentPage: async ({ page }, use) => use(new StudentEnrollmentPage(page)),
  lessonPage: async ({ page }, use) => use(new LessonPage(page)),
  courseSettingsPage: async ({ page }, use) => use(new CourseSettingsPage(page)),
  myLearningPage: async ({ page }, use) => use(new MyLearningPage(page)),
  orgSettingsPage: async ({ page }, use) => use(new OrgSettingsPage(page)),
  coursePeoplePage: async ({ page }, use) => use(new CoursePeoplePage(page)),
});
