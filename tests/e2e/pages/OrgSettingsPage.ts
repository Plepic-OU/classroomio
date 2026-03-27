import { Page, expect } from '@playwright/test';

export class OrgSettingsPage {
  constructor(private page: Page) {}

  private async waitForOrgSettled(): Promise<void> {
    // The layout's getProfileDebounced(1000ms) fires after onMount and calls
    // getOrganizations(), which does currentOrg.set(orgData). If we type before
    // this REST call completes, getOrganizations will overwrite our input.
    // Waiting for the organizationmember response ensures the store is final.
    await this.page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/organizationmember') && response.status() === 200,
      { timeout: 10000 }
    );
  }

  async gotoOrgTab(orgSiteName: string) {
    // Inject classroomio_org_sitename into localStorage BEFORE the page loads.
    // addInitScript runs before page scripts, ensuring getOrganizations() reads
    // the correct siteName even when the admin has multiple org memberships.
    await this.page.addInitScript(
      (siteName) => localStorage.setItem('classroomio_org_sitename', siteName),
      orgSiteName
    );

    // Set up response watcher BEFORE goto so we don't miss the debounced call.
    const orgSettled = this.waitForOrgSettled();

    await this.page.goto(`/org/${orgSiteName}/settings?tab=org&org=${orgSiteName}`);

    // Wait for the debounced getOrganizations to complete — $currentOrg is final after this.
    await orgSettled;

    const field = this.page.getByLabel('Organization Name');
    await field.waitFor();
    await expect(field).not.toHaveValue('', { timeout: 5000 });
  }

  async changeOrgName(newName: string) {
    const field = this.page.getByLabel('Organization Name');
    await field.click({ clickCount: 3 });
    // pressSequentially fires keydown/input events per character — required to trigger
    // Svelte's bind:value store update (fill() sets the DOM value but skips Svelte reactivity).
    await field.pressSequentially(newName, { delay: 10 });
  }

  async saveOrgSettings() {
    await this.page.getByRole('button', { name: 'Update Organization' }).click();
  }

  async expectSuccessNotification() {
    await this.page.getByText('Update successful').waitFor();
  }

  async getOrgName(): Promise<string> {
    return this.page.getByLabel('Organization Name').inputValue();
  }

  async reloadAndVerifyName(expectedName: string) {
    await this.page.reload();
    // SSR loads $currentOrg from DB on every request — the field will show the
    // persisted DB value once the org store is populated. We don't need to wait
    // for the debounced getOrganizations (we're reading, not writing).
    const field = this.page.getByLabel('Organization Name');
    await field.waitFor();
    await expect(field).toHaveValue(expectedName, { timeout: 10000 });
  }
}
