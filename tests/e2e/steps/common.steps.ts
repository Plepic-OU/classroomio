import { Given } from './fixtures';
import { expect } from '@playwright/test';
import { loginAs } from '../helpers/login';

Given('I am logged in as {string}', async ({ page }, email: string) => {
  await loginAs(page, email);
});

Given('I have created a course named {string}', async ({ page }, title: string) => {
  await page.goto('/org/udemy-test/courses');
  await expect(page).toHaveURL(/\/org\/udemy-test\/courses/, { timeout: 15_000 });
  await page.getByRole('button', { name: /create course/i }).click();
  await page.getByText('Live Class', { exact: true }).click();
  await page.getByRole('button', { name: /next/i }).click();
  await page.getByPlaceholder(/course name/i).fill(title);
  await page.getByPlaceholder(/a little description/i).fill('Test course');
  await page.getByRole('button', { name: /finish/i }).click();
  await expect(page).toHaveURL(/\/courses\/([^/]+)$/, { timeout: 15_000 });
});
