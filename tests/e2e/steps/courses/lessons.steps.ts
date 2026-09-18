import { When, Then } from '../../fixtures';

When('I open the course content tab', async ({ page }) => {
  // exact:true — a loose match would also catch the "Content" h4 heading that appears
  // once already on the /lessons page (relevant if this step is ever reused after another
  // navigation lands there first).
  await page.getByText('Content', { exact: true }).first().click();
  await page.waitForURL(/\/lessons$/);
});

When('I add a new section titled {string}', async ({ page }, title: string) => {
  await page.getByRole('button', { name: /^add$/i }).click();
  await page.getByLabel('Section Title', { exact: false }).fill(title);
  await page.getByRole('button', { name: /^save$/i }).click();
});

When(
  'I add a lesson titled {string} to the {string} section',
  async ({ page }, lessonTitle: string, sectionTitle: string) => {
    const section = page.locator('[role="listitem"]').filter({ hasText: sectionTitle });
    // The "+" add-lesson button sits inside a drag-and-drop zone that's aria-disabled
    // whenever dragging isn't active. A real mouse click works fine (pointer-events:
    // auto), but Playwright's actionability check inherits that ancestor's aria-disabled
    // and refuses a plain click — force it. See references/lessons.md.
    await section.locator('button').first().click({ force: true });
    await page.getByLabel('Lesson Title', { exact: false }).fill(lessonTitle);
    await page.getByRole('button', { name: /^save$/i }).click();
  }
);

Then('I should be redirected to the lesson editor', async ({ page }) => {
  // No explicit timeout override — playwright.config.ts's 10s test timeout is always the
  // real ceiling regardless of what's passed here, so a longer value here is dead weight.
  await page.waitForURL(/\/lessons\/[^/]+$/);
});

Then('I should see the lesson title {string}', async ({ page }, title: string) => {
  await page.getByText(title, { exact: false }).first().waitFor();
});
