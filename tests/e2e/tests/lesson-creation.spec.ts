import { test, expect } from '../fixtures/base';

let courseId: string;

test.describe('Lesson creation', () => {
  test.beforeAll(async ({ supabaseAdmin }) => {
    // Find a seed course that the admin user (admin@test.com) is actually a member of.
    // Not all seed courses include the admin — query via group membership.
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

    const { data } = await supabaseAdmin
      .from('course')
      .select('id')
      .in('group_id', groupIds)
      .not('title', 'like', 'Test%')
      .limit(1)
      .single();

    courseId = data!.id;
  });

  test.afterAll(async ({ supabaseAdmin }) => {
    await supabaseAdmin.from('lesson').delete().like('title', 'Test Lesson%');
  });

  test('create a new lesson inside an existing course', async ({ page }) => {
    await page.goto(`/courses/${courseId}/lessons`);

    // Open the Add Lesson modal
    await page.getByRole('button', { name: 'Add' }).click();

    const modal = page.locator('.dialog');
    await modal.waitFor({ state: 'visible' });

    // TextField uses a <p> tag for labels (not <label>), so getByLabel doesn't work.
    // Use the single input inside the modal instead.
    await modal.locator('input').fill('Test Lesson');

    await modal.getByRole('button', { name: 'Save' }).click();

    // After Save the modal closes. For V1 courses the page redirects to the lesson editor;
    // for V2 (section-based) courses it stays on the lessons list.
    // Assert the modal is gone and the new item title is visible.
    await expect(modal).not.toBeVisible();
    await expect(page.getByText('Test Lesson').first()).toBeVisible();
  });
});
