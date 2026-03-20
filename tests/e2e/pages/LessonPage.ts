import { Page } from '@playwright/test';

export class LessonPage {
  constructor(private page: Page) {}

  async gotoLessons(courseId: string) {
    await this.page.goto(`/courses/${courseId}/lessons`);
    // Wait for the page to fully load (lessons store must hydrate)
    await this.page.getByRole('button', { name: 'Add' }).waitFor();
  }

  async addLesson(title: string) {
    await this.page.getByRole('button', { name: 'Add' }).click();
    // Modal heading: "Add New Lesson"
    await this.page.getByText('Add New Lesson').waitFor();
    await this.page.getByLabel('Lesson Title').fill(title);
    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  async expectLessonEditor() {
    // After saving, the app navigates to /courses/[id]/lessons/[lessonId]
    await this.page.waitForURL('**/courses/**/lessons/**');
  }
}
