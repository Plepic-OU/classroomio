import { test, expect } from '../fixtures/base';

const ORG_SLUG = 'udemy-test';

test.describe('Courses list', () => {
  test('courses page loads and displays course cards', async ({ page }) => {
    await page.goto(`/org/${ORG_SLUG}/courses`);

    // Wait for page to fully load — Create Course button becomes enabled after org admin check
    const createBtn = page.getByRole('button', { name: 'Create Course' });
    await expect(createBtn).toBeEnabled();

    // Course cards are rendered inside a section with class "cards-container".
    // Each card is a <div role="button">. Verify at least one card is present.
    const courseCards = page.locator('.cards-container [role="button"]');
    await expect(courseCards.first()).toBeVisible();
  });
});
