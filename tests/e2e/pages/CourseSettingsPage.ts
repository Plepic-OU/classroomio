import { Page, expect } from '@playwright/test';

export class CourseSettingsPage {
  constructor(private page: Page) {}

  async gotoSettings(courseId: string) {
    await this.page.goto(`/courses/${courseId}/settings`);
    // Wait for the settings form to load
    await this.page.getByText('Publish Course').waitFor();
  }

  async togglePublish() {
    // Carbon Toggle: the input[role="switch"] is visually hidden; a <label> intercepts
    // pointer events. Use force:true to bypass the hit-test and click the underlying input.
    // The publish toggle is the last switch on the page.
    const switches = this.page.getByRole('switch');
    const count = await switches.count();
    await switches.nth(count - 1).click({ force: true });
  }

  async enableWaitlist() {
    // Wait for the waitlist section to render, then scroll it into view.
    const sectionText = this.page.getByText('Enrollment / Waiting List');
    await sectionText.waitFor();
    await sectionText.scrollIntoViewIfNeeded();
    // Waitlist toggle is second-to-last switch (publish is always last).
    // Uses check() to ensure the checkbox moves to checked state regardless of current state.
    const switches = this.page.getByRole('switch');
    const count = await switches.count();
    await switches.nth(count - 2).check({ force: true });
  }

  async setMaxCapacity(n: number) {
    // After enabling waitlist, the NumberInput appears. Use pressSequentially for Svelte binding.
    const input = this.page.getByLabel('Max capacity (students)');
    await input.waitFor();
    await input.click({ clickCount: 3 });
    await input.pressSequentially(String(n));
  }

  async saveChanges() {
    await this.page.getByRole('button', { name: 'Save Changes' }).click();
  }

  async expectPublished() {
    // After save, the toggle for the publish section shows "Published" as active label
    await this.page.getByText('Published').first().waitFor();
  }

  async expectWaitlistEnabled() {
    // The max capacity input is only visible when waitlist is enabled
    await expect(this.page.getByLabel('Max capacity (students)')).toBeVisible();
  }
}
