import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { getAdminOrgSiteName } from '../helpers/supabase';

const { Given, Then } = createBdd(test);

Given('I am logged in and navigate to My Learning', async ({ myLearningPage }) => {
  const orgSiteName = await getAdminOrgSiteName();
  await myLearningPage.goto(orgSiteName);
});

Then('I should see at least one course on the My Learning page', async ({ myLearningPage }) => {
  await myLearningPage.expectAtLeastOneCourse();
});
