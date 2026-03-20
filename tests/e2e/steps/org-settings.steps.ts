import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { getAdminOrgSiteName } from '../helpers/supabase';

const { Given, When, Then } = createBdd(test);

let originalOrgName: string;

Given('I am on the org settings organization tab', async ({ orgSettingsPage }) => {
  const orgSiteName = await getAdminOrgSiteName();
  await orgSettingsPage.gotoOrgTab(orgSiteName);
  originalOrgName = await orgSettingsPage.getOrgName();
});

When('I change the org name and save', async ({ orgSettingsPage }) => {
  await orgSettingsPage.changeOrgName('Test Updated Org');
  await orgSettingsPage.saveOrgSettings();
});

Then('I should see a success notification', async ({ orgSettingsPage }) => {
  await orgSettingsPage.expectSuccessNotification();
  // Restore original name to avoid polluting org state for other tests
  await orgSettingsPage.changeOrgName(originalOrgName);
  await orgSettingsPage.saveOrgSettings();
});
