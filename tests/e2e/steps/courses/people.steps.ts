import { expect } from '@playwright/test';
import { Given, When, Then } from '../../fixtures';

Given('I am on the people page for that course', async ({ page, ctx }) => {
  await page.goto(`/courses/${ctx.courseId}/people`);
  await page.waitForSelector('aside', { state: 'visible' });
});

When('I click the add people button', async ({ page }) => {
  // "Add" button in people layout header — translation: course.navItem.people.add = "Add"
  await page.getByRole('button', { name: /^add$/i }).click();
  // Modal opens via URL param ?add=true
  await page.waitForURL(/\?add=true/);
});

Then('the invitation modal should be visible', async ({ page }) => {
  // Modal heading: course.navItem.people.invite_modal.title = "Invite people"
  await expect(page.getByText(/invite people/i)).toBeVisible();
});

When('I click the copy link button', async ({ page }) => {
  // "Copy link" button inside invitation modal — hardcoded button text
  // translation: course.navItem.people.invite_modal.copy_link = "Copy link"
  await page.getByRole('button', { name: /copy link/i }).click();
});

Then('the copy confirmation should appear', async ({ page }) => {
  // Carbon Popover shows "Copied Successfully" after clicking copy link
  // translation: course.navItem.people.invite_modal.success = "Copied Successfully"
  await expect(page.getByText(/copied successfully/i)).toBeVisible();
});
