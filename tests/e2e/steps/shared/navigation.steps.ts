import { Given } from '../../fixtures';

Given('I am on the courses page', async ({ page }) => {
  await page.goto('/org/udemy-test/courses');
  await page.waitForURL(/\/courses/);
});

Given('I am on the LMS explore page', async ({ page }) => {
  // ?org=udemy-test sets the _orgSiteName cookie so currentOrg store is populated
  // Without this, getCurrentOrg returns null on localhost and getCourses never fires
  await page.goto('http://localhost:5173/lms/explore?org=udemy-test');
  await page.waitForSelector('aside', { state: 'visible' });
});

Given('I am on the LMS page', async ({ page }) => {
  await page.goto('http://localhost:5173/lms');
  await page.waitForSelector('aside', { state: 'visible' });
});

Given('I am on the My Learning page', async ({ page }) => {
  // ?org=udemy-test sets the _orgSiteName cookie so currentOrg store is populated.
  // networkidle ensures the JS bundle has loaded and Svelte has hydrated, so that
  // tab button click handlers are attached before any When step fires a click.
  await page.goto('http://localhost:5173/lms/mylearning?org=udemy-test', { waitUntil: 'networkidle' });
  await page.waitForSelector('aside', { state: 'visible' });
});
