import { Page, expect } from '@playwright/test';

export class CoursePeoplePage {
  constructor(private page: Page) {}

  async gotoPeople(courseId: string) {
    // Register the response waiter before navigation so we don't miss the request.
    const courseDataLoaded = this.page.waitForResponse(
      (resp) => resp.url().includes('/api/courses/data') && resp.status() === 200
    );
    await this.page.goto(`/courses/${courseId}/people`);
    // Wait for the async fetchCourseFromAPI call to complete so $course is populated.
    await courseDataLoaded;
  }

  async clickWaitlistTab() {
    await this.page.getByRole('tab', { name: 'Waiting List' }).click();
  }

  async expectWaitlistTabVisible() {
    await expect(this.page.getByRole('tab', { name: 'Waiting List' })).toBeVisible();
  }

  async approveFirst() {
    await this.page.getByRole('button', { name: 'Approve' }).first().click();
  }

  async expectWaitlistEmpty() {
    await this.page.getByText('No students on the waiting list').waitFor();
  }

  async expectEnrolledHeaderVisible() {
    await this.page.getByText(/enrolled/).waitFor();
  }
}
