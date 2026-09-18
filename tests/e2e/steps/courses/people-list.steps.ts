import { Then, When } from '../../fixtures';

When('I open the course people tab', async ({ page }) => {
  await page.getByText('People', { exact: true }).first().click();
  await page.waitForURL(/\/people/);
});

Then(
  'I should see myself listed as {string} in the people table',
  async ({ page }, role: string) => {
    // Word-boundary, not a plain string filter: 'You' as a substring would also match a
    // display name/email containing "You" (e.g. "Youssef", "you@domain.com").
    const myRow = page.getByRole('row').filter({ hasText: /\bYou\b/ });
    await myRow.waitFor();
    await myRow.getByText(role, { exact: false }).waitFor();
  }
);
