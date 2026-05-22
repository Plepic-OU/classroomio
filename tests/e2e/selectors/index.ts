/**
 * Named selectors — per design §3 + §5.
 *
 * Step defs import named accessors from here so a UI drift fix lands in one
 * file. Selector priority is documented in §5:
 *   1. getByRole(name) with accessible-name regex
 *   2. getByLabel / getByPlaceholder
 *   3. getByTestId
 *   4. CSS literal (last resort — only here, never inline in steps)
 *
 * Entries are added as scenarios need them; this file starts with the
 * selectors used by F-01 / F-03.
 */
import type { Page, Locator } from '@playwright/test';

// --- Login (F-01) ---

export const loginEmail = (page: Page): Locator =>
  page.getByPlaceholder('you@domain.com');

export const loginPassword = (page: Page): Locator =>
  page.getByPlaceholder('************');

export const loginSubmit = (page: Page): Locator =>
  page.getByRole('button', { name: /log\s*in/i }).first();

export const loginErrorBanner = (page: Page): Locator =>
  page.locator('.text-red-500');

// --- Sidebar profile menu (F-01 logout) ---

/**
 * Profile menu trigger in the org sidebar. The button's accessible name is
 * `<username> <fullname>` (Avatar img alt + fullname paragraph). The seeded
 * fullname is stable per persona — see helpers/test-users.ts — so we look
 * up by fullname rather than baking literals here.
 */
export const profileMenuTrigger = (page: Page, fullname: string): Locator =>
  page.getByRole('button', { name: new RegExp(escapeRegex(fullname), 'i') }).first();

/**
 * "Log out" entry inside the open profile menu. The Menu.svelte component
 * renders it as a <button> whose visible text is the translated
 * `settings.profile.logout` key ("Log out" in English — locale is pinned to
 * en for seed users via test-fixtures.sql).
 */
export const logoutMenuItem = (page: Page): Locator =>
  page.getByRole('button', { name: /log\s*out/i }).last();

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
