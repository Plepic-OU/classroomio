import { test as base, createBdd } from 'playwright-bdd';
import { LoginPage } from '../pages/LoginPage';
import { CoursePage } from '../pages/CoursePage';

export const test = base.extend<{
  loginPage: LoginPage;
  coursePage: CoursePage;
  orgSlug: string;
}>({
  // orgSlug must be known — seed data should document the local org siteName
  orgSlug: [process.env.ORG_SLUG ?? 'udemy-test', { option: true }],
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  coursePage: async ({ page, orgSlug }, use) => use(new CoursePage(page, orgSlug)),
});

// Step definitions must import { Given, When, Then } from here, not from 'playwright-bdd' directly
export const { Given, When, Then } = createBdd(test);
