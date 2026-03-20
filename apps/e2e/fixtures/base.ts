import { test as base, chromium } from '@playwright/test';
import path from 'path';

export const STORAGE_STATE = path.join(__dirname, '../.auth/user.json');

// Reusable authenticated context — logs in once and saves storageState
export async function saveAuthState(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(process.env.BASE_URL ?? 'http://localhost:5173');
  await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL ?? 'admin@test.com');
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD ?? '123456');
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/org\//);
  await page.context().storageState({ path: STORAGE_STATE });
  await browser.close();
}

export const test = base.extend({});
export { expect } from '@playwright/test';
