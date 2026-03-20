import { Page } from '@playwright/test';

export class CoursePage {
  constructor(private page: Page) {}

  async openCreateModal() {
    await this.page.getByRole('button', { name: 'Create Course' }).click();
  }

  async selectCourseType(type: string) {
    // The modal backdrop (fixed inset-0) can intercept pointer events during animation.
    // Dispatch click directly to bypass hit-test checks.
    await this.page.getByRole('button', { name: type }).click({ force: true });
    await this.page.getByRole('button', { name: 'Next' }).click();
  }

  async fillDetails(title: string, description: string) {
    await this.page.getByLabel('Course name').fill(title);
    // The Short Description label contains AI button text, making getByLabel ambiguous.
    // Use the placeholder to uniquely identify the description textarea.
    await this.page.getByPlaceholder('A little description about this course').fill(description);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Finish' }).click();
  }

  async expectCourseVisible(title: string) {
    await this.page.getByText(title).first().waitFor();
  }
}
