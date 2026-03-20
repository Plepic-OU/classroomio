import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { createUnpublishedTestCourse } from '../helpers/supabase';

const { Given, When, Then } = createBdd(test);

let courseId: string;

Given(
  'I am on the settings page for an unpublished test course',
  async ({ courseSettingsPage }) => {
    courseId = await createUnpublishedTestCourse('[TEST] Publish Me Course');
    await courseSettingsPage.gotoSettings(courseId);
  }
);

When('I toggle the course to published and save', async ({ courseSettingsPage }) => {
  await courseSettingsPage.togglePublish();
  await courseSettingsPage.saveChanges();
});

Then('the course should show as published', async ({ courseSettingsPage }) => {
  await courseSettingsPage.expectPublished();
});
