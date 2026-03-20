import { test as base, createBdd } from 'playwright-bdd';
import type { Page } from '@playwright/test';

/**
 * Wait for SvelteKit hydration to complete.
 * The root +layout.svelte sets data-hydrated on document.body inside onMount(),
 * which fires only after the client-side framework has fully hydrated the SSR HTML.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.locator('body[data-hydrated]').waitFor();
}

export const test = base;
export const { Given, When, Then } = createBdd(test);
