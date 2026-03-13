# Playwright Design Document — Validation Report

**Date:** 2026-03-13
**Source:** `docs/plans/2026-03-13-bdd-playwright-setup-design.md`
**Method:** Validated by three independent Claude agents (Haiku, Sonnet, Opus) against the actual codebase.

---

## Unanimous Findings (all 3 agents agree)

| Issue | Details |
|-------|---------|
| **Missing `@supabase/supabase-js` dependency** | Cleanup code imports it, but only `@playwright/test` is listed in Dependencies |
| **Missing `SUPABASE_SERVICE_ROLE_KEY` config** | No `.env.example`, no `dotenv` dep, no docs on how to provide the key |
| **Step 1 locators are broken** | `getByPlaceholder('').first()` won't work. Correct values: `"Your course name"` and `"A little description about this course"` |
| **Incomplete cleanup** | Only deletes from `course` table, but creation also inserts into `group`, `groupmember`, and `newsfeed` |
| **No shared login helper** | Both tests duplicate the full login flow; `storageState` pattern should be planned |
| **Pretest only checks dashboard** | Should also check Supabase (54321) and API (3002) are running |
| **`sudo` risk for browser install** | `playwright install --with-deps` needs root; devcontainer runs as user `node` |
| **Hardcoded `udemy-test` slug** | Fragile if seed data changes |

## Confirmed Correct (all 3 agents verified)

- Login placeholders (`you@domain.com`, `************`)
- Button labels (`Log In`, `Create Course`, `Next`, `Finish`) — all match i18n keys
- `getByLabel()` concern is valid (TextField uses `<p>` not proper `<label>`)
- Post-login redirect to `/org/[siteName]` — confirmed via `appSetup.ts`
- DevContainer port config is accurate
- Cypress "kept alongside" decision is correct

## Notable Divergences

| Finding | Haiku | Sonnet | Opus |
|---------|:-----:|:------:|:----:|
| **`trace: 'on-first-retry'` contradicts `retries: 0`** (traces never captured) | - | Yes | Yes |
| **No `tsconfig.json` for `e2e/`** | Yes | Yes | Yes (minor) |
| **Missing `e2e/pnpm-lock.yaml` mention** | - | Yes | - |
| **Login redirect timing risk** (1s debounce in appSetup) | Yes | Yes | Yes (most detailed — identified the debounce) |
| **Use `?create=true` URL instead of button click** | - | Yes | Yes |
| **Bake browser install into Dockerfile** | - | - | Yes |
| **Post-creation redirects to `/courses/[id]` not courses list** | Yes | Yes | Yes |
| **Mobile viewport risk** (icon-only button) | Yes | Yes | Yes |

## Agent-Specific Insights

**Haiku** — Fastest but least detailed. Caught all the critical issues. Missed the `trace`/`retries` contradiction.

**Sonnet** — Most structured output. Uniquely flagged: Cypress may already be non-functional (not in root devDependencies), and `pnpm-lock.yaml` for `e2e/` should be committed.

**Opus** — Deepest code-level analysis. Uniquely identified: the 1-second debounce in `getProfile` that affects redirect timing, and suggested baking browser deps into the Dockerfile rather than a manual step.

## Top Priority Fixes (consensus)

1. **Fix step 1 locators** — replace TODO with `'Your course name'` / `'A little description about this course'`
2. **Fix `trace` config** — change to `'retain-on-failure'` (or set `retries: 1`)
3. **Add `@supabase/supabase-js`** to `e2e/package.json` + document service role key
4. **Expand cleanup** to cover `group`/`groupmember`/`newsfeed` or use `supabase db reset` in `globalSetup`
5. **Expand pretest** to check Supabase and API, not just the dashboard
6. **Address `sudo` requirement** for `playwright install --with-deps`
