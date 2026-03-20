import { expect, type Page } from '@playwright/test';

export class CoursePage {
  constructor(private page: Page) {}

  async selectCourseType(type: 'Live Class' | 'Self Paced') {
    await this.page.getByRole('button', { name: type }).click();
  }

  async clickNext() {
    await this.page.getByRole('button', { name: 'Next' }).click();
  }

  async fillTitle(title: string) {
    await this.page.getByPlaceholder('Your course name').fill(title);
  }

  async fillDescription(desc: string) {
    await this.page.getByPlaceholder('A little description about this course').fill(desc);
  }

  async save() {
    await this.page.getByRole('button', { name: 'Finish' }).click();
  }

  async expectCourseCreated(title: string) {
    await expect(this.page.getByText(title)).toBeVisible();
  }
}
