import { test, expect } from '../fixtures/base';

const ORG_SLUG = 'udemy-test';

test.describe('Org audience', () => {
  test('audience page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/audience`);

    // Use getByRole('heading') to avoid strict-mode violation:
    // "Audience" also appears in the sidebar nav link as a <p> element.
    await expect(page.getByRole('heading', { name: 'Audience', exact: true })).toBeVisible();

    // The Export button is always present regardless of whether the org has any students.
    // It confirms the page fully loaded (not just the heading which is static HTML).
    const exportBtn = page.getByRole('button', { name: 'Export' });
    await expect(exportBtn).toBeVisible();
  });
});
