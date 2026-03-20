import { Page, expect } from '@playwright/test';

export class OrgSettingsPage {
  constructor(private page: Page) {}

  async gotoOrgTab(orgSiteName: string) {
    // Inject classroomio_org_sitename into localStorage BEFORE the page loads.
    // addInitScript runs before page scripts, ensuring getOrganizations() reads
    // the correct siteName even when the admin has multiple org memberships
    // (e.g., from student enrollment tests polluting the organizationmember table).
    await this.page.addInitScript(
      (siteName) => localStorage.setItem('classroomio_org_sitename', siteName),
      orgSiteName
    );
    // Pass ?org= so the layout server SSR-loads the org immediately (no 1s debounce + getOrganizations round-trip)
    await this.page.goto(`/org/${orgSiteName}/settings?tab=org&org=${orgSiteName}`);
    // Wait for the org name field to be populated (after getOrganizations resolves).
    // The field exists immediately but has an empty value until the org store is set.
    const field = this.page.getByLabel('Organization Name');
    await field.waitFor();
    await expect(field).not.toHaveValue('');
  }

  async changeOrgName(newName: string) {
    const field = this.page.getByLabel('Organization Name');
    await field.click({ clickCount: 3 });
    // pressSequentially fires keydown/input events per character — required to trigger
    // Svelte's bind:value store update (fill() sets the DOM value but skips Svelte reactivity)
    await field.pressSequentially(newName, { delay: 10 });
  }

  async saveOrgSettings() {
    await this.page.getByRole('button', { name: 'Update Organization' }).click();
  }

  async expectSuccessNotification() {
    // No explicit timeout — Playwright uses remaining test budget (10s total)
    await this.page.getByText('Update successful').waitFor();
  }

  async getOrgName(): Promise<string> {
    return this.page.getByLabel('Organization Name').inputValue();
  }
}
