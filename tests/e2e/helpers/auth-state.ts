import fs from 'node:fs';
import type { Page } from '@playwright/test';

interface StorageState {
  cookies?: Array<Record<string, unknown>>;
  origins?: { origin: string; localStorage: { name: string; value: string }[] }[];
}

/**
 * Whether a cached storageState file still holds a non-expired Supabase session, so it's
 * safe to reuse across runs. Cached files live in the source tree (see fixtures.ts) so
 * repeated local runs don't pay for two real UI logins every time — but Supabase rotates
 * refresh tokens (supabase/config.toml enable_refresh_token_rotation), so a file left over
 * from a previous session more than jwt_expiry ago is dead and must be regenerated rather
 * than reused, or every scenario using it hangs until its own timeout with no clear cause.
 *
 * The buffer is generous (30min, against a 60min jwt_expiry) because this check only runs
 * once per worker (see fixtures.ts), not once per scenario that reuses the cached file —
 * supabase-js itself refreshes a token once under 90s of life left (auth-js's
 * EXPIRY_MARGIN_MS), and a narrower buffer here could pass a file that then goes stale
 * mid-worker, re-injecting a pre-rotation token via restoreStorageState's addInitScript
 * after supabase-js has already rotated it (refresh_token_reuse_interval=10 rejects that).
 */
export function isStorageStateFresh(file: string): boolean {
  if (!fs.existsSync(file)) return false;

  try {
    const state: StorageState = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const bufferSeconds = 1800;

    for (const origin of state.origins ?? []) {
      for (const item of origin.localStorage ?? []) {
        // Key on the Supabase auth-token entry specifically (name is "sb-<project-ref>-
        // auth-token"), not just "the first localStorage value that happens to parse as
        // JSON with an expires_at field" — an unrelated entry sharing that shape would
        // otherwise silently decide freshness.
        if (!item.name.startsWith('sb-') || !item.name.endsWith('-auth-token')) continue;
        try {
          const parsed = JSON.parse(item.value);
          if (typeof parsed?.expires_at === 'number') {
            return Date.now() / 1000 < parsed.expires_at - bufferSeconds;
          }
        } catch {
          // Malformed auth-token entry — treat as stale, fall through to re-login.
        }
      }
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Applies a previously saved Playwright storageState (cookies + localStorage) to a page
 * and navigates to '/', so a scenario can start "logged in" without repeating the UI
 * login flow.
 *
 * Both cookies and localStorage must be in place *before* the first navigation: the app
 * only redirects an authenticated visitor away from the public '/' marketing page via a
 * client-side boot check that reads the session from localStorage on hydration, not a
 * per-request server check — restoring localStorage after that first load (e.g. via a
 * post-navigation page.evaluate()) is too late, the check has already run and rendered
 * the marketing page. That's why this uses page.addInitScript() instead, even though an
 * init script keeps re-running on every later navigation in the scenario and would
 * clobber tokens supabase-js refreshes mid-scenario. In practice that's not a live risk
 * here: scenarios run against a 10s test timeout, far under the Supabase JWT's 1h expiry
 * (supabase/config.toml jwt_expiry), and no scenario navigates through a second login or
 * logout yet. Revisit (e.g. drop the init script once past the first navigation) if a
 * future scenario needs either of those.
 */
export async function restoreStorageState(page: Page, file: string) {
  const state: StorageState = JSON.parse(fs.readFileSync(file, 'utf-8'));

  if (state.cookies?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.context().addCookies(state.cookies as any);
  }

  if (state.origins?.length) {
    await page.addInitScript((origins) => {
      for (const origin of origins) {
        for (const item of origin.localStorage) {
          window.localStorage.setItem(item.name, item.value);
        }
      }
    }, state.origins);
  }

  await page.goto('/');
}
