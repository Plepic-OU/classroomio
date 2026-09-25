import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';
import { When, Then, AfterScenario } from '../../fixtures';
import { DB_CONTAINER } from '../../helpers/reset-db';

type OrgSettingsState = {
  orgSlug?: string;
  originalOrgName?: string;
  newOrgName?: string;
  orgNameRestored?: boolean;
};

const orgNameField = (page: Page) => page.getByLabel('Organization Name');

async function saveOrgSettings(page: Page) {
  // Wait on the Supabase write itself, not the "Update successful" snackbar: OrgSettings'
  // handleUpdate() shows that snackbar before it checks the update's error.
  const response = page.waitForResponse(
    (res) => res.url().includes('/rest/v1/organization') && res.request().method() === 'PATCH'
  );
  await page.getByRole('button', { name: /update organization/i }).click();
  expect((await response).ok()).toBe(true);
}

When('I open the organization settings', async ({ page, sharedState }) => {
  const slug = new URL(page.url()).pathname.match(/^\/org\/([^/]+)/)?.[1];
  if (!slug) throw new Error(`Expected to be on an /org/<slug> page, got ${page.url()}`);
  (sharedState as OrgSettingsState).orgSlug = slug;

  // The sidebar's settings links sit in collapsed dropdowns (profile menu, org switcher),
  // so go straight to the Organization tab.
  await page.goto(`/org/${slug}/settings?tab=org`);
  await expect(page.getByRole('tab', { name: 'Organization', selected: true })).toBeVisible();
});

When('I change the organization name to {string}', async ({ page, sharedState }, name: string) => {
  const state = sharedState as OrgSettingsState;
  const field = orgNameField(page);

  // The field is bound to the currentOrg store, which fills in after the page loads.
  await expect(field).not.toHaveValue('');
  state.originalOrgName = await field.inputValue();
  // Per-run suffix, so a stale value from an earlier run can't make the reload check pass.
  state.newOrgName = `${name} ${Date.now()}`;

  await field.fill(state.newOrgName);
  await saveOrgSettings(page);
});

When('I reload the page', async ({ page }) => {
  await page.reload();
});

Then('the organization name should be the new name', async ({ page, sharedState }) => {
  await expect(orgNameField(page)).toHaveValue((sharedState as OrgSettingsState).newOrgName!);
});

When('I restore the original organization name', async ({ page, sharedState }) => {
  const state = sharedState as OrgSettingsState;
  const field = orgNameField(page);

  await expect(field).not.toHaveValue('');
  await field.fill(state.originalOrgName!);
  await saveOrgSettings(page);
  state.orgNameRestored = true;
});

Then('the organization name should be the original name', async ({ page, sharedState }) => {
  await expect(orgNameField(page)).toHaveValue((sharedState as OrgSettingsState).originalOrgName!);
});

// The organization table survives resetTestData() (see PRESERVE_TABLES), so a scenario that
// fails between renaming and restoring would leave the org renamed for every later run.
// Put the original name back directly in the DB whenever the restore step didn't get to run.
AfterScenario(async ({ sharedState }) => {
  const { orgSlug, originalOrgName, orgNameRestored } = sharedState as OrgSettingsState;
  if (!orgSlug || !originalOrgName || orgNameRestored) return;

  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      DB_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-v',
      `name=${originalOrgName}`,
      '-v',
      `site=${orgSlug}`
    ],
    { input: `UPDATE organization SET name = :'name' WHERE "siteName" = :'site';`, stdio: 'pipe' }
  );
});
