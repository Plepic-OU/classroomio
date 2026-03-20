import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { getAdminTaughtCourseId } from '../helpers/supabase';

const { Given, When, Then } = createBdd(test);

let courseId: string;

Given('I am on the lessons page for a course I teach', async ({ lessonPage }) => {
  courseId = await getAdminTaughtCourseId();
  await lessonPage.gotoLessons(courseId);
});

When('I add a lesson titled {string}', async ({ lessonPage }, title: string) => {
  await lessonPage.addLesson(title);
});

Then('I should be taken to the lesson editor', async ({ lessonPage }) => {
  await lessonPage.expectLessonEditor();
});
