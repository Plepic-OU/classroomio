import { expect } from '@playwright/test';
import { Given, When, Then, waitForHydration } from './fixtures';

async function navigateToCourse(page) {
  await page.goto('/org/udemy-test/courses');
  await waitForHydration(page);
  // Click the "Data Science" course card (a published course with allowNewStudent)
  await page.getByRole('heading', { name: 'Data Science with Python and Pandas' }).click();
  await waitForHydration(page);
}

Given('I navigate to a course settings page', async ({ page }) => {
  await navigateToCourse(page);
  await page.getByText('Settings', { exact: true }).click();
  await waitForHydration(page);
});

Given('I navigate to the course people page', async ({ page }) => {
  await navigateToCourse(page);
  await page.getByText('People', { exact: true }).click();
  await waitForHydration(page);
});

When('I set the max capacity to {int}', async ({ page }, capacity: number) => {
  const capacityInput = page.getByRole('spinbutton', { name: /max capacity/i });
  await capacityInput.click();
  await capacityInput.fill(String(capacity));
  // Press Tab to trigger the change event so the waitlist toggle appears
  await capacityInput.press('Tab');
});

When('I enable the waiting list toggle', async ({ page }) => {
  // The waitlist toggle appears after max_capacity is set.
  // Carbon Toggle uses a hidden input[role="switch"] with a label overlay.
  // We must click the label, not the input, because the label intercepts pointer events.
  const waitlistLabel = page.getByText('Enable Waiting List');
  await expect(waitlistLabel).toBeVisible();

  const row = waitlistLabel.locator('xpath=ancestor::div[contains(@class, "bx--row")]');
  const toggleLabel = row.locator('label.bx--toggle-input__label');
  await toggleLabel.click();
});

When('I click save', async ({ page }) => {
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText('Saved successfully')).toBeVisible();
});

When('I navigate to the course landing page', async ({ page }) => {
  await page.getByText('Landing Page', { exact: true }).click();
  await waitForHydration(page);
});

Then('the max capacity input should have value {string}', async ({ page }, value: string) => {
  const capacityInput = page.getByRole('spinbutton', { name: /max capacity/i });
  await expect(capacityInput).toHaveValue(value);
});

Then('the waiting list toggle should be visible', async ({ page }) => {
  await expect(page.getByText('Enable Waiting List')).toBeVisible();
});

Then('I should see {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text).first()).toBeVisible();
});

Then('I should see a {string} button', async ({ page }, label: string) => {
  await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible();
});

When('I click the waiting list tab', async ({ page }) => {
  await page.getByRole('tab', { name: /waiting list/i }).click();
});
