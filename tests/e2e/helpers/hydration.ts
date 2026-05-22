import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function waitForLoginHydration(page: Page) {
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
}
