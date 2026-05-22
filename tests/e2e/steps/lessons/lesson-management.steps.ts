import { Given, When, Then } from '../../fixtures';

When('I go to the lessons tab', async ({ page }) => {
  await page.getByRole('button', { name: /^content$/i }).click();
  await page.waitForURL(/\/lessons/);
});

When('I click the add lesson button', async ({ page }) => {
  await page.getByRole('button', { name: /^add$/i }).click();
  await page.getByText(/add new (lesson|section)/i).waitFor();
});

When('I enter the lesson title {string}', async ({ page }, title: string) => {
  await page.getByLabel(/(lesson|section) title/i).fill(title);
});

When('I save the new lesson', async ({ page }) => {
  await page.getByRole('button', { name: /^save$/i }).click();
});

Then('I should see {string} in the lessons list', async ({ page }, lessonTitle: string) => {
  await page.getByText(lessonTitle).first().waitFor();
});
