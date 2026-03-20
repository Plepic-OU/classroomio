import type { Page } from '@playwright/test';

/**
 * Wait for SvelteKit client-side hydration on the login page.
 * SSR renders inputs as type="text". After hydration, Svelte's use:typeAction
 * directive sets the correct type (e.g. "email"). Waiting for this selector
 * is a reliable, CSP-safe signal that component-level hydration is complete.
 */
export async function waitForHydration(page: Page) {
  await page.locator('input[type="email"]').waitFor({ timeout: 15_000 });
}
