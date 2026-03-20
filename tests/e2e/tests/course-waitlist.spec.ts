import { test, expect, type Page } from '../fixtures/base';

// Seed user IDs from supabase/seed.sql
const STUDENT_PROFILE_ID = '0c256e75-aa40-4f62-8d30-0217ca1c60d9'; // student@test.com / John Doe
const ALT_STUDENT_PROFILE_ID = '01676a50-bb56-4c5e-8a61-fb9e9190fb10'; // test@test.com / Alice

// The people-page filter uses a custom Select.svelte with bind:value={object}.
// Select options are objects ({ label, value }) created via .map(), so filterBy (ROLES[0])
// never matches any option by reference. This means no option is natively "selected" on load.
// Use evaluate() to set selectedIndex and dispatch 'change' — this triggers Svelte's
// bind:value handler which reads selectedOptions[0].__value reliably.
async function selectWaitlistFilter(page: Page) {
  // Wait for course data to load. The nav sidebar shows 'People' button only after
  // $course.id is set. If we switch the filter before $course.id is set, the reactive
  // loadWaitlist guard ($course.id &&) won't fire.
  await expect(
    page.getByRole('complementary').getByRole('button', { name: 'People' })
  ).toBeVisible();

  const sel = page.locator('select.form-select');
  await expect(sel.locator('option', { hasText: 'Waitlist' })).toBeAttached();
  // Waitlist is option index 4 (Filter=0, Admin=1, Tutor=2, Student=3, Waitlist=4).
  // Set selectedIndex directly and dispatch 'change' to trigger Svelte's bind:value.
  await sel.evaluate((el: HTMLSelectElement) => {
    el.selectedIndex = 4;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // Wait for the waitlist section to render — one of these will appear depending on state
  await expect(
    page.getByText('No enrollment cap is set — students join directly.').or(
      page.getByText('No students are currently on the waitlist.').or(
        page.getByText('Position')
      )
    )
  ).toBeVisible();
}

let courseId: string;
let courseName: string;
let courseDescription: string;
let groupId: string;
let orgSiteName: string;

test.describe('Course waitlist', () => {
  test.beforeAll(async ({ supabaseAdmin }) => {
    // Create a fresh test course with no pre-existing students.
    // This avoids FK constraint issues with seed data (e.g., question_answer → groupmember).
    const adminProfileId = '7ac00503-8519-43c8-a5ea-b79aeca900b1'; // admin@test.com

    // Get the org that admin@test.com belongs to
    const { data: orgMember } = await supabaseAdmin
      .from('organizationmember')
      .select('organization_id, organization!organizationmember_organization_id_fkey(siteName)')
      .eq('profile_id', adminProfileId)
      .limit(1)
      .single();

    const orgId = orgMember!.organization_id;
    orgSiteName = (orgMember as any).organization.siteName;

    // Create a group for the course
    const { data: newGroup } = await supabaseAdmin
      .from('group')
      .insert({ name: 'Test Waitlist Group', organization_id: orgId })
      .select('id')
      .single();
    groupId = newGroup!.id;

    // Create the course
    courseName = 'Test Waitlist Course';
    courseDescription = 'E2E test course for waitlist feature';
    const { data: newCourse } = await supabaseAdmin
      .from('course')
      .insert({
        title: courseName,
        description: courseDescription,
        group_id: groupId,
        slug: 'test-waitlist-' + Date.now(),
        is_published: true
      })
      .select('id')
      .single();
    courseId = newCourse!.id;

    // Add admin@test.com as tutor (role_id=2)
    await supabaseAdmin.from('groupmember').insert({
      group_id: groupId,
      role_id: 2,
      profile_id: adminProfileId,
      email: 'admin@test.com'
    });
  });

  test.afterAll(async ({ supabaseAdmin }) => {
    // Clean up: cascade will handle groupmember and course_waitlist
    if (courseId) {
      await supabaseAdmin.from('course_waitlist').delete().eq('course_id', courseId);
      await supabaseAdmin.from('groupmember').delete().eq('group_id', groupId);
      await supabaseAdmin.from('course').delete().eq('id', courseId);
      await supabaseAdmin.from('group').delete().eq('id', groupId);
    }
  });

  test('teacher sets max enrollment in settings → capacity badge appears in navigation', async ({
    page,
    supabaseAdmin
  }) => {
    // Ensure clean starting state
    await supabaseAdmin.from('course').update({ max_capacity: null }).eq('id', courseId);

    await page.goto(`/courses/${courseId}/settings`);

    // Wait for settings to load (course data is fetched async via CourseContainer)
    const titleInput = page.locator('label').filter({ hasText: 'Course title' }).locator('input');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).not.toHaveValue('');

    // Carbon NumberInput — locate by placeholder since Carbon labels may not be
    // associated via a <label for="..."> in all versions
    const maxInput = page.getByPlaceholder('Unlimited');
    await expect(maxInput).toBeVisible();
    await maxInput.fill('30');
    // Press Tab to trigger Carbon NumberInput's on:change dispatcher (fires with e.detail)
    await maxInput.press('Tab');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Saved successfully')).toBeVisible();

    // Navigate to people page — capacity badge should appear in the sidebar navigation
    await page.goto(`/courses/${courseId}/people`);
    // Badge format: "{enrolled} / {total} enrolled" e.g. "0 / 30 enrolled"
    await expect(page.getByText(/\/\s*30\s*enrolled/)).toBeVisible();
  });

  test('waitlist filter shows waitlisted student with position number', async ({
    page,
    supabaseAdmin
  }) => {
    // Seed: set capacity to 1, enroll alt student to fill the slot, waitlist student
    await supabaseAdmin.from('course').update({ max_capacity: 1 }).eq('id', courseId);
    await supabaseAdmin
      .from('groupmember')
      .delete()
      .eq('group_id', groupId)
      .eq('profile_id', ALT_STUDENT_PROFILE_ID);
    await supabaseAdmin.from('groupmember').insert({
      group_id: groupId,
      role_id: 3,
      profile_id: ALT_STUDENT_PROFILE_ID,
      email: 'test@test.com'
    });
    await supabaseAdmin
      .from('course_waitlist')
      .delete()
      .eq('course_id', courseId)
      .eq('profile_id', STUDENT_PROFILE_ID);
    await supabaseAdmin.from('course_waitlist').insert({
      course_id: courseId,
      profile_id: STUDENT_PROFILE_ID
    });

    await page.goto(`/courses/${courseId}/people`);

    // Switch to Waitlist filter — custom Select component renders a <select> element
    await selectWaitlistFilter(page);

    // Waitlisted student (John Doe / student@test.com) should appear at position #1
    await expect(page.getByText('#1')).toBeVisible();
    await expect(page.getByText('John Doe')).toBeVisible();

    // Clean up the alt student enrollment so it doesn't affect subsequent tests
    await supabaseAdmin
      .from('groupmember')
      .delete()
      .eq('group_id', groupId)
      .eq('profile_id', ALT_STUDENT_PROFILE_ID);
  });

  test('teacher approves waitlisted student → student removed from waitlist', async ({
    page,
    supabaseAdmin
  }) => {
    // Seed: set capacity, ensure student is NOT enrolled, and place on waitlist
    await supabaseAdmin.from('course').update({ max_capacity: 1 }).eq('id', courseId);
    await supabaseAdmin
      .from('groupmember')
      .delete()
      .eq('group_id', groupId)
      .eq('profile_id', STUDENT_PROFILE_ID);
    await supabaseAdmin
      .from('course_waitlist')
      .delete()
      .eq('course_id', courseId)
      .eq('profile_id', STUDENT_PROFILE_ID);
    await supabaseAdmin.from('course_waitlist').insert({
      course_id: courseId,
      profile_id: STUDENT_PROFILE_ID
    });

    // Register console listener BEFORE navigation to catch the profile load event.
    // handleApprove returns early if $profile.id is not set — we must wait for it.
    const profileLoaded = page.waitForEvent('console', {
      predicate: (msg) => msg.text().includes('Get profile'),
      timeout: 15000
    });
    await page.goto(`/courses/${courseId}/people`);
    await profileLoaded;
    await selectWaitlistFilter(page);

    await expect(page.getByText('John Doe')).toBeVisible();

    await page.getByRole('button', { name: 'Approve' }).click();

    // After approval the waitlist should be empty
    await expect(page.getByText('No students are currently on the waitlist.')).toBeVisible();

    // Clean up: remove the newly enrolled student so later tests start clean
    await supabaseAdmin
      .from('groupmember')
      .delete()
      .eq('group_id', groupId)
      .eq('profile_id', STUDENT_PROFILE_ID);
  });

  test('student joins full course via invite link → gets waitlisted', async ({
    page,
    studentPage,
    supabaseAdmin
  }) => {
    // Seed: enroll alt student so the course is full (max_capacity=1)
    await supabaseAdmin.from('course').update({ max_capacity: 1 }).eq('id', courseId);
    await supabaseAdmin
      .from('groupmember')
      .delete()
      .eq('group_id', groupId)
      .eq('profile_id', ALT_STUDENT_PROFILE_ID);
    await supabaseAdmin.from('groupmember').insert({
      group_id: groupId,
      role_id: 3,
      profile_id: ALT_STUDENT_PROFILE_ID,
      email: 'test@test.com'
    });
    // Ensure student@test.com is not already enrolled or waitlisted
    await supabaseAdmin
      .from('groupmember')
      .delete()
      .eq('group_id', groupId)
      .eq('profile_id', STUDENT_PROFILE_ID);
    await supabaseAdmin
      .from('course_waitlist')
      .delete()
      .eq('course_id', courseId)
      .eq('profile_id', STUDENT_PROFILE_ID);

    // Build the invite hash (same encoding as +layout.server.ts: btoa(JSON.stringify({...})))
    const hashPayload = JSON.stringify({
      id: courseId,
      name: courseName,
      description: courseDescription,
      orgSiteName
    });
    const hash = encodeURIComponent(Buffer.from(hashPayload).toString('base64'));

    // Student visits the invite page (already logged in via student-auth-state.json)
    await studentPage.goto(`/invite/s/${hash}`);
    await expect(studentPage.getByRole('heading', { name: courseName, exact: false })).toBeVisible();

    await studentPage.getByRole('button', { name: 'Join Course' }).click();

    // Student is redirected to /lms after being waitlisted
    await expect(studentPage).toHaveURL(/\/lms/, { timeout: 10000 });

    // Teacher verifies the student appears in the Waitlist filter
    await page.goto(`/courses/${courseId}/people`);
    await selectWaitlistFilter(page);

    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('#1')).toBeVisible();
  });

  test('enrolled student drops course → waitlist entries remain visible', async ({
    page,
    supabaseAdmin
  }) => {
    // Seed: enroll alt student (1 of 1 capacity), put student@test.com on waitlist
    await supabaseAdmin.from('course').update({ max_capacity: 1 }).eq('id', courseId);
    await supabaseAdmin
      .from('groupmember')
      .delete()
      .eq('group_id', groupId)
      .eq('profile_id', ALT_STUDENT_PROFILE_ID);
    await supabaseAdmin.from('groupmember').insert({
      group_id: groupId,
      role_id: 3,
      profile_id: ALT_STUDENT_PROFILE_ID,
      email: 'test@test.com'
    });
    await supabaseAdmin
      .from('course_waitlist')
      .delete()
      .eq('course_id', courseId)
      .eq('profile_id', STUDENT_PROFILE_ID);
    await supabaseAdmin.from('course_waitlist').insert({
      course_id: courseId,
      profile_id: STUDENT_PROFILE_ID
    });

    // Baseline: teacher sees John Doe on the waitlist
    await page.goto(`/courses/${courseId}/people`);
    await selectWaitlistFilter(page);
    await expect(page.getByText('John Doe')).toBeVisible();

    // Simulate an enrolled student dropping: remove alt student via DB directly
    await supabaseAdmin
      .from('groupmember')
      .delete()
      .eq('group_id', groupId)
      .eq('profile_id', ALT_STUDENT_PROFILE_ID);

    // Reload the page — capacity badge now shows 0 enrolled but waitlist entry persists
    await page.reload();
    await selectWaitlistFilter(page);
    await expect(page.getByText('John Doe')).toBeVisible();

    // Capacity badge should reflect the updated enrollment count (0 / 1 enrolled)
    // Switch back to "Filter" (All) view — index 0
    const sel = page.locator('select.form-select');
    await sel.evaluate((el: HTMLSelectElement) => {
      el.selectedIndex = 0;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.getByText(/0\s*\/\s*1\s*enrolled/)).toBeVisible();
  });
});
