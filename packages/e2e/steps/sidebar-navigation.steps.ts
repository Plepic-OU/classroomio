import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given: given, When: when, Then: then } = createBdd();

given('I am on the org dashboard page', async ({ page }) => {
  await page.goto('/org/testorg');
  await page.waitForTimeout(1000);
});

when('I click the {string} sidebar link', async ({ page }, linkName: string) => {
  // Sidebar uses <a> tags with <p> label text inside
  await page.getByRole('link', { name: linkName }).click();
});

then('I should be on the org courses page', async ({ page }) => {
  await page.waitForURL('**/org/testorg/courses');
  await expect(page).toHaveURL(/\/org\/testorg\/courses/);
});

then('I should be on the org community page', async ({ page }) => {
  await page.waitForURL('**/org/testorg/community');
  await expect(page).toHaveURL(/\/org\/testorg\/community/);
});
