import { createBdd } from 'playwright-bdd';
import { OrgSettingsPage } from '../../pages/org-settings.page';

const { When, Then } = createBdd();

When('I navigate to organization settings for {string}', async ({ page }, slug: string) => {
  const orgSettings = new OrgSettingsPage(page);
  await orgSettings.goto(slug);
});

When('I set the organization name to {string}', async ({ page }, name: string) => {
  const orgSettings = new OrgSettingsPage(page);
  await orgSettings.setOrgName(name);
});

When('I save the organization settings', async ({ page }) => {
  const orgSettings = new OrgSettingsPage(page);
  await orgSettings.save();
});

When('I reload the settings page', async ({ page }) => {
  await page.reload();
  await page.locator('html[theme]').waitFor({ state: 'attached' });
});

Then('the organization name should be {string}', async ({ page }, name: string) => {
  const orgSettings = new OrgSettingsPage(page);
  await orgSettings.expectOrgName(name);
});

Then('I restore the organization name to {string}', async ({ page }, name: string) => {
  const orgSettings = new OrgSettingsPage(page);
  await orgSettings.setOrgName(name);
  await orgSettings.save();
});
