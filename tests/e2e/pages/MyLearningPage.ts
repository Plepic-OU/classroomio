import { Page } from '@playwright/test';

export class MyLearningPage {
  constructor(private page: Page) {}

  async goto(orgSiteName: string) {
    // Pass ?org= so the root layout.server.ts sets the _orgSiteName cookie,
    // which initializes $currentOrg and allows fetchCourses() to run.
    await this.page.goto(`/lms/mylearning?org=${encodeURIComponent(orgSiteName)}`);
    await this.page.getByRole('heading', { name: 'My Learning' }).waitFor({ timeout: 15000 });
  }

  async expectAtLeastOneCourse() {
    // Course cards in LMS mode render as <div role="button"> (not <a>), and include
    // a "Continue Course" PrimaryButton when isLMS=true. The getProfile call that
    // populates $profile.id is debounced by 1s, so allow up to 20s for courses to load.
    await this.page
      .getByRole('button', { name: 'Continue Course' })
      .first()
      .waitFor({ timeout: 20000 });
  }
}
