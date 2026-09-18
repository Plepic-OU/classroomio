import { When, Then } from '../../fixtures';

// "I open the course people tab" is defined in steps/courses/people-list.steps.ts and
// reused here — playwright-bdd registers steps globally across the project. Defined there
// rather than here on purpose: this file's scenario is @known-issue (excluded from normal
// runs), and people-list.feature (which passes normally) needs this step to keep working
// independently of whether this file's scenario or tag ever changes.

When('I copy the student invite link', async ({ page, sharedState }) => {
  // Clipboard read requires the context to hold clipboard permissions — grant it here
  // rather than at context creation, since fixtures.ts's page fixture is generic.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: /^add$/i }).click();
  await page.getByRole('button', { name: /copy link/i }).click();
  sharedState.inviteLink = await page.evaluate(() => navigator.clipboard.readText());
});

When('I open the copied invite link', async ({ page, sharedState }) => {
  if (typeof sharedState.inviteLink !== 'string') {
    throw new Error('No invite link in sharedState — run "I copy the student invite link" first');
  }
  await page.goto(sharedState.inviteLink);
});

When('I click the join course button', async ({ page }) => {
  await page.getByRole('button', { name: /join course/i }).click();
});

Then('I should be redirected away from the invite page', async ({ page }) => {
  await page.waitForURL((url) => !url.pathname.startsWith('/invite/'), { timeout: 10_000 });
});
