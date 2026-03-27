import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures';
import { getAdminOrgSiteName } from '../../helpers/supabase';

const { Given, When, Then } = createBdd(test);

const NEW_ORG_NAME = 'Test Updated Org';
let originalOrgName: string;
let orgSiteName: string;

Given('I am on the org settings organization tab', async ({ orgSettingsPage }) => {
  orgSiteName = await getAdminOrgSiteName();
  await orgSettingsPage.gotoOrgTab(orgSiteName);
  originalOrgName = await orgSettingsPage.getOrgName();
});

When('I change the org name and save', async ({ orgSettingsPage }) => {
  await orgSettingsPage.changeOrgName(NEW_ORG_NAME);
  await orgSettingsPage.saveOrgSettings();
});

Then('I should see a success notification', async ({ orgSettingsPage }) => {
  await orgSettingsPage.expectSuccessNotification();
});

Then('the org name persists after page reload', async ({ orgSettingsPage }) => {
  await orgSettingsPage.reloadAndVerifyName(NEW_ORG_NAME);
});

Then('the original org name is restored', async ({ orgSettingsPage }) => {
  await orgSettingsPage.changeOrgName(originalOrgName);
  await orgSettingsPage.saveOrgSettings();
  await orgSettingsPage.expectSuccessNotification();
});
