import { createBdd } from 'playwright-bdd';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { CoursePage } from '../pages/course.page';

const { Given, When, Then } = createBdd();

Given(
  'I am logged in as {string} with {string}',
  async ({ page }, email: string, password: string) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, password);
    await loginPage.expectDashboardRedirect();
  }
);

Given('I am on the dashboard', async ({ page }) => {
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.expectLoaded();
});

When('I click the new course button', async ({ page }) => {
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.clickNewCourse();
});

When('I select {string} as the course type', async ({ page }, type: string) => {
  const coursePage = new CoursePage(page);
  await coursePage.selectCourseType(type as 'Live Class' | 'Self Paced');
});

When('I click next', async ({ page }) => {
  const coursePage = new CoursePage(page);
  await coursePage.clickNext();
});

When('I fill in the course title with {string}', async ({ page }, title: string) => {
  const coursePage = new CoursePage(page);
  await coursePage.fillTitle(title);
});

When('I fill in the course description with {string}', async ({ page }, desc: string) => {
  const coursePage = new CoursePage(page);
  await coursePage.fillDescription(desc);
});

When('I save the course', async ({ page }) => {
  const coursePage = new CoursePage(page);
  await coursePage.save();
});

Then('I should see {string} in the course page', async ({ page }, title: string) => {
  const coursePage = new CoursePage(page);
  await coursePage.expectCourseCreated(title);
});
