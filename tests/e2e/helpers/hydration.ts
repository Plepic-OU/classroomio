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

/**
 * Route → hydration signal. The signal is something visible only after the
 * route's client bundle has booted. Add a new entry when adding coverage for
 * a new route; the absence of an entry falls through to a generic body probe.
 *
 * Per design §5: this is also where we wait for @sveltekit-i18n/base to
 * settle (translations resolved) — without it, the dashboard's mid-page
 * locale flip in getProfile() can race a getByRole(name) assertion.
 */
type Probe = (page: Page) => Promise<void>;

const ROUTE_PROBES: Array<{ match: RegExp; probe: Probe }> = [
  {
    match: /^\/login\/?$/,
    probe: (page) => page.locator('input[type="email"]').waitFor({ timeout: 15_000 }),
  },
  {
    match: /^\/org\/[^/]+\/?$/,
    // The sidebar's <complementary> region attaches early but its org-name
    // button is populated only after the currentOrg store loads. Wait for
    // the Dashboard nav link inside the sidebar — it appears just after
    // the org-name button does. Without this, expect.toBeVisible on the
    // org-name button can race the render when F-03 runs right after a
    // logout (observed Chunk E pass 2).
    probe: (page) =>
      page
        .getByRole('complementary')
        .getByRole('link', { name: /^Dashboard$/i })
        .first()
        .waitFor({ timeout: 15_000 }),
  },
];

async function genericProbe(page: Page): Promise<void> {
  await page.locator('body').waitFor({ state: 'attached', timeout: 15_000 });
}

/**
 * Wait for route-specific hydration. Pass the route pathname (or a substring
 * that matches it). If no probe is registered, falls back to a generic body
 * probe — that's intentional: most routes work fine with Playwright's
 * auto-wait + accessible-name selectors, and a missing probe is not an error.
 */
export async function waitForRouteHydration(page: Page, route: string): Promise<void> {
  const entry = ROUTE_PROBES.find((p) => p.match.test(route));
  await (entry?.probe ?? genericProbe)(page);
}
