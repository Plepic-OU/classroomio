import { expect, type Page } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  async expectLoaded() {
    await expect(this.page.getByRole('button', { name: 'Create Course' })).toBeVisible();
  }

  async clickNewCourse() {
    await this.page.getByRole('button', { name: 'Create Course' }).click();
  }
}
