import { test, expect } from '../fixtures/base';

let courseId: string;
let originalTitle: string;

test.describe('Course settings', () => {
  test.beforeAll(async ({ supabaseAdmin }) => {
    // Find a seed course that admin@test.com is a member of (admin role)
    const { data: profile } = await supabaseAdmin
      .from('profile')
      .select('id')
      .eq('email', 'admin@test.com')
      .single();

    const { data: memberships } = await supabaseAdmin
      .from('groupmember')
      .select('group_id')
      .eq('profile_id', profile!.id);

    const groupIds = (memberships ?? []).map((m) => m.group_id);

    const { data: course } = await supabaseAdmin
      .from('course')
      .select('id, title')
      .in('group_id', groupIds)
      .not('title', 'like', 'Test%')
      .limit(1)
      .single();

    courseId = course!.id;
    originalTitle = course!.title;
  });

  test.afterAll(async ({ supabaseAdmin }) => {
    // Restore the original title
    await supabaseAdmin.from('course').update({ title: originalTitle }).eq('id', courseId);
  });

  test('update course title', async ({ page }) => {
    await page.goto(`/courses/${courseId}/settings`);

    // Find the "Course title" input via its <label> wrapper (TextField component)
    const titleInput = page
      .locator('label')
      .filter({ hasText: 'Course title' })
      .locator('input');
    await expect(titleInput).toBeVisible();
    // Wait for the course API to finish loading — CourseContainer fetches course data
    // asynchronously after mount and calls setDefault($course) which resets the store.
    // If we fill before the API responds, our value gets overwritten.
    await expect(titleInput).not.toHaveValue('');

    await titleInput.fill('Test Course Updated');

    // Button label is "Save Changes" (translation key: course.navItem.settings.save)
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Success snackbar
    await expect(page.getByText('Saved successfully')).toBeVisible();
  });
});
