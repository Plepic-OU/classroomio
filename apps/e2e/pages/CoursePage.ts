import type { Page } from '@playwright/test';

export class CoursePage {
  // URL is org-scoped: /org/<siteName>/courses
  constructor(
    private page: Page,
    private orgSlug: string
  ) {}

  async goto() {
    await this.page.goto(`/org/${this.orgSlug}/courses`);
  }

  async createCourse(title: string) {
    // Step 0: open modal and select course type
    await this.page.getByRole('button', { name: /create course/i }).click();
    await this.page.getByRole('button', { name: /live class|self paced/i }).first().click();
    await this.page.getByRole('button', { name: /next/i }).click();

    // Step 1: fill in course name + required short description, then submit
    await this.page.getByLabel('Course name').fill(title);
    await this.page.getByLabel('Short Description').fill('Test course description');
    await this.page.getByRole('button', { name: /finish/i }).click();
  }

  async getCourseNames(): Promise<string[]> {
    return this.page.getByTestId('course-title').allTextContents();
  }
}
