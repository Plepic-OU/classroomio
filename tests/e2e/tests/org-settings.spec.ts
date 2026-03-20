import { test, expect } from '../fixtures/base';

const ORG_SLUG = 'udemy-test';
const ORIGINAL_NAME = 'Udemy Test';
const NEW_NAME = 'Test Org Renamed';

test.describe('Org settings', () => {
  test.afterAll(async ({ supabaseAdmin }) => {
    await supabaseAdmin
      .from('organization')
      .update({ name: ORIGINAL_NAME })
      .eq('siteName', ORG_SLUG);
  });

  test('update organisation name', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/settings`);

    // Click the "Organization" tab (only visible/enabled for org admins)
    await page.getByRole('tab', { name: 'Organization' }).click();

    // TextField wraps <input> in a <label> element.
    // getByLabel() doesn't work (label text is in a child <p>, not the label itself).
    // Use the <label> element's text content to scope the input selector.
    const nameInput = page
      .locator('label')
      .filter({ hasText: 'Organization Name' })
      .locator('input');
    await expect(nameInput).toBeVisible();

    await nameInput.fill(NEW_NAME);
    await page.getByRole('button', { name: 'Update Organization' }).click();

    // Success snackbar appears with the translated message
    await expect(page.getByText('Update successful')).toBeVisible();
  });
});
