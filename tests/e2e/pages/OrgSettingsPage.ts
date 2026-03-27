import { Page, expect } from '@playwright/test';

export class OrgSettingsPage {
  constructor(private page: Page) {}

  async gotoOrgTab(orgSiteName: string) {
    // Inject classroomio_org_sitename into localStorage BEFORE the page loads.
    // addInitScript runs before page scripts, ensuring getOrganizations() reads
    // the correct siteName even when the admin has multiple org memberships.
    await this.page.addInitScript(
      (siteName) => localStorage.setItem('classroomio_org_sitename', siteName),
      orgSiteName
    );

    // Best-effort wait for the debounced getOrganizations REST response.
    // The layout's getProfileDebounced(1s) fires after onMount and calls
    // getOrganizations() → currentOrg.set(orgData), potentially overwriting any
    // typed value. We wait for the response so the store is settled before we type.
    //
    // In the full test suite getProfile() may early-return (profile already cached)
    // meaning no organizationmember request is ever made — in that case the store is
    // already settled so we safely fall through via .catch(() => null).
    const orgSettled = this.page
      .waitForResponse(
        (r) => r.url().includes('/rest/v1/organizationmember') && r.status() === 200,
        { timeout: 3000 }
      )
      .catch(() => null);

    await this.page.goto(`/org/${orgSiteName}/settings?tab=org&org=${orgSiteName}`);

    // Debounce(1s) + REST call (~500ms) = ~1.5s total. If not received by 3s it's not coming.
    await orgSettled;

    const field = this.page.getByLabel('Organization Name');
    await field.waitFor();
    await expect(field).not.toHaveValue('', { timeout: 8000 });
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
