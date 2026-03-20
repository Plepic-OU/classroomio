import { Page } from '@playwright/test';

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

  async saveChanges() {
    await this.page.getByRole('button', { name: 'Save Changes' }).click();
  }

  async expectPublished() {
    // After save, the toggle for the publish section shows "Published" as active label
    await this.page.getByText('Published').first().waitFor();
  }
}
