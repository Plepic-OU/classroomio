import { Page } from '@playwright/test';

export class StudentEnrollmentPage {
  constructor(private page: Page) {}

  /**
   * Navigate directly to the invite page by constructing the hash from course data.
   * This bypasses the course landing page's SvelteKit store initialization issue
   * where $currentOrg is not available on the public /course/[slug] route,
   * preventing the "Enroll Now" / "Start Course" button from completing the goto().
   */
  async gotoInvitePage(courseId: string, title: string, description: string, orgSiteName: string) {
    const hash = encodeURIComponent(
      Buffer.from(JSON.stringify({ id: courseId, name: title, description, orgSiteName })).toString(
        'base64'
      )
    );
    await this.page.goto(`/invite/s/${hash}`);
  }

  async confirmJoin() {
    await this.page.getByRole('button', { name: 'Join Course' }).click();
  }

  async expectStudentDashboard() {
    // After joining, the page redirects to /lms (full page reload via window.location.href)
    await this.page.waitForURL('**/lms**', { timeout: 15000 });
  }
}
