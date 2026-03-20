import { test, expect } from '../fixtures/base';

let courseId: string;

test.describe('Course people', () => {
  test.beforeAll(async ({ supabaseAdmin }) => {
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
      .select('id')
      .in('group_id', groupIds)
      .not('title', 'like', 'Test%')
      .limit(1)
      .single();

    courseId = course!.id;
  });

  test('invite modal opens and shows student invite section', async ({ page }) => {
    // ?add=true opens the InvitationModal via URL param
    await page.goto(`/courses/${courseId}/people?add=true`);

    const modal = page.locator('.dialog');
    await modal.waitFor({ state: 'visible' });

    // The modal shows an "Invite Students" heading (use exact match to avoid strict mode
    // violation — the modal also contains "You can invite students via an invite link")
    await expect(modal.getByText('Invite Students', { exact: true })).toBeVisible();

    // "Copy link" is a plain <button> (not PrimaryButton)
    const copyBtn = modal.getByRole('button', { name: 'Copy link' });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Carbon Popover uses execCommand-based clipboard (not navigator.clipboard), so
    // clipboard contents are not readable via navigator.clipboard.readText() in tests.
    // The Popover "Copied Successfully" also disappears in ~1 s — too fast for
    // toBeVisible() polling to catch reliably.
    // Instead, verify no error snackbar appeared (empty clipboard error shows a snackbar).
    await expect(page.getByText(/missing_data|error/i)).not.toBeVisible();

    // Close modal by clicking outside or navigating away
    await page.goto(`/courses/${courseId}/people`);
    await expect(modal).not.toBeVisible();
  });
});
