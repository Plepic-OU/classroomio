import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import {
  makeCourseFull,
  clearCourseCapacity,
  clearWaitlist,
  addToWaitlist,
  removeFromWaitlist,
} from '../../helpers/waitlist';

const { Given, When, Then } = createBdd();

// --- Setup steps (DB operations, no browser interaction) ---

Given(
  'the course {string} has no capacity limit',
  async ({}, courseTitle: string) => {
    clearCourseCapacity(courseTitle);
  }
);

Given(
  'the course {string} is full with waitlist enabled',
  async ({}, courseTitle: string) => {
    clearWaitlist(courseTitle);
    makeCourseFull(courseTitle, true);
  }
);

Given(
  'the course {string} is full with waitlist disabled',
  async ({}, courseTitle: string) => {
    clearWaitlist(courseTitle);
    makeCourseFull(courseTitle, false);
  }
);

Given(
  'the student is not on the waitlist for {string}',
  async ({}, courseTitle: string) => {
    removeFromWaitlist('student@test.com', courseTitle);
  }
);

Given(
  'the student is on the waitlist for {string}',
  async ({}, courseTitle: string) => {
    addToWaitlist('student@test.com', courseTitle);
  }
);

// --- Course navigation steps ---

When('I open the course {string}', async ({ page }, courseTitle: string) => {
  await page.getByText(courseTitle).first().click();
  // Wait for the course page to load (URL changes to /courses/[uuid])
  await page.waitForURL(/\/courses\/[a-f0-9-]+/);
});

When('I navigate to the settings tab', async ({ page }) => {
  // Course nav items are <button> elements in a sidebar, not links
  await page.getByRole('button', { name: /settings/i }).click();
  await page.waitForURL(/\/settings/);
});

When('I navigate to the people tab', async ({ page }) => {
  await page.getByRole('button', { name: /people/i }).click();
  await page.waitForURL(/\/people/);
});

When('I set the max capacity to {int}', async ({ page }, capacity: number) => {
  const input = page.locator('input[type="number"]').first();
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await input.fill(String(capacity));
  // Carbon NumberInput fires on:change with e.detail — trigger input event
  await input.dispatchEvent('input');
  await input.dispatchEvent('change');
  // Press Tab to blur and trigger any remaining event handlers
  await input.press('Tab');
});

When('I enable the waitlist toggle', async ({ page }) => {
  // Scroll to the Enable Waitlist toggle section
  const sectionTitle = page.getByText('Enable Waitlist').first();
  await sectionTitle.scrollIntoViewIfNeeded();

  // Carbon Toggle has a hidden checkbox input — find it by the toggle's ID pattern
  // The toggle shows "Disabled" in slot labelA and "Enabled" in slot labelB
  // We need to click the toggle track (the visual toggle element)
  // Use the Carbon Toggle's internal structure: look for the toggle near our section
  const toggleTrack = page.locator('[class*="bx--toggle"]').last();
  const isChecked = await toggleTrack.isChecked().catch(() => false);

  if (!isChecked) {
    await toggleTrack.click({ force: true });
  }
});

When('I save the course settings', async ({ page }) => {
  await page.getByRole('button', { name: /save/i }).click();
});

Then('I should see a success notification', async ({ page }) => {
  await page.getByText(/saved successfully/i).waitFor({ timeout: 5000 });
});

// --- Landing page steps ---

When(
  'I visit the course landing page for {string}',
  async ({ page }, courseTitle: string) => {
    // Derive slug from course title
    const slug = courseTitle.toLowerCase().replace(/\s+/g, '-');
    // Use full page navigation to avoid SvelteKit client-side routing interference
    await page.goto(`http://localhost:5173/course/${slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(`**/course/${slug}`, { timeout: 15000 });
  }
);

Then(
  'I should see a {string} button',
  async ({ page }, buttonLabel: string) => {
    await expect(
      page.getByRole('button', { name: new RegExp(buttonLabel, 'i') }).first()
    ).toBeVisible();
  }
);

Then(
  'I should see a disabled {string} button',
  async ({ page }, buttonLabel: string) => {
    const button = page.getByRole('button', { name: new RegExp(buttonLabel, 'i') }).first();
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
  }
);

When('I click the {string} button', async ({ page }, buttonLabel: string) => {
  await page
    .getByRole('button', { name: new RegExp(buttonLabel, 'i') })
    .first()
    .click();
});

Then('I should see a waitlist confirmation message', async ({ page }) => {
  await page.getByText(/added to the waitlist/i).waitFor({ timeout: 5000 });
});

Then('I should see a waitlist removal message', async ({ page }) => {
  await page.getByText(/removed from the waitlist/i).waitFor({ timeout: 5000 });
});

// --- People tab / waitlist management steps ---

When('I select the {string} filter', async ({ page }, filterName: string) => {
  // Native <select> — use selectOption with the option index
  // The Waitlist option is the last one in the ROLES array
  const select = page.locator('select').first();
  // Get all options and find the one matching the filter name
  const options = select.locator('option');
  const count = await options.count();
  for (let i = 0; i < count; i++) {
    const text = await options.nth(i).textContent();
    if (text && new RegExp(filterName, 'i').test(text.trim())) {
      await select.selectOption({ index: i });
      break;
    }
  }
});

Then(
  'I should see {string} in the waitlist',
  async ({ page }, studentName: string) => {
    await page.getByText(studentName).waitFor({ timeout: 5000 });
  }
);

When(
  'I click the approve button for {string}',
  async ({ page }, studentName: string) => {
    const row = page.locator('tr, [role="row"]').filter({ hasText: studentName });
    await row.getByRole('button', { name: /approve/i }).click();
  }
);

Then('I should see a student approved notification', async ({ page }) => {
  await page.getByText(/approved successfully/i).waitFor({ timeout: 5000 });
});
