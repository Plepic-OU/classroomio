import { expect, type Page } from '@playwright/test';

export class OrgSettingsPage {
  constructor(private page: Page) {}

  async goto(slug: string) {
    await this.page.goto(`/org/${slug}/settings?tab=org`);
    await this.page.locator('html[theme]').waitFor({ state: 'attached' });
  }

  private orgNameInput() {
    return this.page.locator('label').filter({ hasText: 'Organization Name' }).locator('input');
  }

  async setOrgName(name: string) {
    const input = this.orgNameInput();
    await input.clear();
    await input.fill(name);
  }

  async save() {
    await this.page.getByRole('button', { name: 'Update Organization' }).click();
    await expect(this.page.getByText('Update successful')).toBeVisible();
  }

  async expectOrgName(name: string) {
    await expect(this.orgNameInput()).toHaveValue(name);
  }
}
