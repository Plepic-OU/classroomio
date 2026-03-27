# Waiting List — Design Document

**Date:** 2026-03-27
**Scope:** Allow landing page visitors to join a waitinglist. Admins can view entries in the dashboard.
**Maturity:** MVP
**Goal:** Capture interest from visitors before they sign up; give admins visibility into demand.

---

## Decisions

| Topic | Decision |
|---|---|
| DB | `waitinglist` table already exists (`id`, `email`, `created_at`). Add RLS policies only. |
| Landing page API | SvelteKit `+server.ts` route in classroomio-com calls Supabase via anon key |
| Supabase access (landing) | Anon key — safe to expose; INSERT-only policy added for `anon` role |
| Supabase access (dashboard) | Authenticated Supabase client; SELECT policy for `authenticated` role |
| Form placement | Hero section of classroomio-com, below existing CTA buttons |
| Success state | Inline message on the page — no redirect |
| Dashboard location | New page `/org/[slug]/waitinglist`, linked from org sidebar |
| Duplicate handling | Unique constraint on `email`; API returns 409 with "Already on the waitinglist" |
| Pagination | None — simple table for MVP (Supabase default max_rows is 1000; acceptable for MVP) |
| Email notification | None — out of scope for MVP |
| Rate limiting | None at DB layer — accepted MVP risk; anon INSERT with no server-side rate limit |
| DELETE/UPDATE policies | None — read-only admin view for MVP |
| Supabase instance | `classroomio-com` and `dashboard` MUST point to the same Supabase project |

---

## Prerequisites

- Local Supabase running (`supabase start`) to apply the migration
- `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` added to `apps/classroomio-com/.env`
  - These must be the same Supabase URL and anon key used by `apps/dashboard`

---

## Database Migration

New file: `supabase/migrations/20260327000000_waitinglist_rls.sql`

```sql
-- RLS was already enabled on waitinglist in a prior migration (20240717053936_rls.sql).
-- This migration adds the access policies only.

-- Allow anonymous visitors to add themselves to the waitinglist
CREATE POLICY "anon can insert waitinglist"
  ON public.waitinglist
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to read the waitinglist
-- NOTE: This grants any authenticated user (not just admins) SELECT access.
-- The waitinglist table has no org_id column so org-scoped RLS is not possible.
-- Access is further restricted at the application layer (sidebar guard + load function auth check).
CREATE POLICY "authenticated can select waitinglist"
  ON public.waitinglist
  FOR SELECT
  TO authenticated
  USING (true);
```

> The table already has `UNIQUE (email)` — duplicate inserts return a Postgres unique violation, which the API route maps to a 409 response.
>
> **Rollback:** `DROP POLICY "anon can insert waitinglist" ON public.waitinglist; DROP POLICY "authenticated can select waitinglist" ON public.waitinglist;`

---

## File Changes

### New files

```
supabase/migrations/20260327000000_waitinglist_rls.sql

apps/classroomio-com/src/
  lib/WaitingList/index.svelte
  routes/api/waitinglist/+server.ts

apps/dashboard/src/routes/org/[slug]/
  waitinglist/+page.svelte
  waitinglist/+page.server.ts

apps/e2e/
  features/waitinglist.feature
  steps/waitinglist.steps.ts
```

### Modified files

```
apps/classroomio-com/src/lib/Home/Hero.svelte     ← embed WaitingListForm below CTA buttons
apps/classroomio-com/.env.example                 ← add PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY
apps/dashboard/src/lib/components/Org/SideBar.svelte  ← add Waitinglist nav item (admin only)
apps/e2e/scripts/check-services.ts                ← add port 5174 health check for classroomio-com
apps/e2e/scripts/reset-db.ts                      ← ensure waitinglist table is included in truncation
```

---

## Landing Page

### `apps/classroomio-com/src/lib/WaitingList/index.svelte`

Self-contained component with three UI states:

- **Default**: email `<TextField>` + "Join Waitinglist" `<Button>` (reuse `$lib/Input/TextField.svelte` and `$lib/Button/Button.svelte` from classroomio-com)
- **Success**: inline "You're on the list!" message replaces the form
- **Error**: inline `<p class="text-red-500">` below the input — message varies by status:
  - 409 → "You're already signed up!"
  - other → "Something went wrong, please try again."

Client-side validation: non-empty + basic email format (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) before submitting (or reuse `isFormValid` from `$lib/utils/isFormValid`). On invalid input, show "Please enter a valid email." without making a network request.

POSTs `{ email }` to `/api/waitinglist`. Sets `isLoading = true` during the request to disable the button.

The form should inherit the Hero section's horizontal centering (`flex items-center justify-center`) to match the CTA button row's visual rhythm.

### `apps/classroomio-com/src/routes/api/waitinglist/+server.ts`

> **Important:** Add `export const prerender = false` at the top of this file. The root `+layout.ts` sets `prerender = true` globally; this opt-out is required to avoid a build error.

```
POST /api/waitinglist
Body: { email: string }
```

1. Parse body; return 400 if email is missing or not a valid format.
2. Call `POST https://{PUBLIC_SUPABASE_URL}/rest/v1/waitinglist` with:
   - Header `apikey: PUBLIC_SUPABASE_ANON_KEY`
   - Header `Authorization: Bearer PUBLIC_SUPABASE_ANON_KEY`
   - Header `Prefer: return=minimal`
   - Body `{ email }`
3. Map responses:

| Supabase response | API response |
|---|---|
| 201 | `201 { message: "Added to waitinglist" }` |
| 409 (unique violation) | `409 { message: "Already on the waitinglist" }` |
| other error | `500 { message: "Something went wrong" }` |

Uses `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` from `$env/static/public`.

Add a 5-second `AbortController` timeout on the `fetch` call to prevent hanging if Supabase is unreachable.

### Hero placement

In `Hero.svelte`, below the existing CTA buttons div (the one containing "Book a demo" and "Sign Up for Free"), add:

```svelte
<WaitingListForm />
```

Import `WaitingListForm` from `$lib/WaitingList/index.svelte`.

### `.env.example` addition

```
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>
```

---

## Dashboard

### `apps/dashboard/src/routes/org/[slug]/waitinglist/+page.server.ts`

> **Auth pattern TBD** — see open decision below. The load function must: (1) confirm the user is authenticated, and (2) confirm the user is an org admin. Do not use `getSupabase().auth.getSession()` — this is the anon-key client and returns `null` server-side. Use `locals` (populated by `hooks.server.ts`) or the service-role client instead.
>
> Use `throw error(500, 'Failed to load waitinglist')` from `@sveltejs/kit` for Supabase errors — do not `throw` the raw error object.

```ts
// Pseudocode — exact auth pattern depends on the open decision below
export const load = async ({ locals, params }) => {
  // 1. Check authenticated (use locals, not getSession)
  // 2. Check is org admin for params.slug
  // 3. Query: supabase.from('waitinglist').select('email, created_at').order('created_at', { ascending: false })
  // 4. Return { entries }
};
```

### `apps/dashboard/src/routes/org/[slug]/waitinglist/+page.svelte`

Simple page with:
- Heading "Waitinglist"
- Count: "X people signed up"
- Table columns: **Email** | **Signed up** (formatted date)
- Empty state: "No one on the waitinglist yet."

### Sidebar

In `SideBar.svelte`, add a "Waitinglist" item to the admin nav section:
- Only visible when `$isOrgAdmin` is true (same pattern as existing admin-only items)
- Link: `$currentOrgPath + '/waitinglist'`
- Label: use `$t('org_navigation.waitinglist')` — add `"waitinglist": "Waitinglist"` to **all 10** translation files (`en.json`, `da.json`, `de.json`, `es.json`, `fr.json`, `hi.json`, `pl.json`, `pt.json`, `ru.json`, `vi.json`)
- Icon: use `List` from `carbon-icons-svelte` (or another appropriate icon); add a `{:else if menuItem.path === '/waitinglist'}` branch to the icon block in `SideBar.svelte`

---

## E2E Tests

### `apps/e2e/features/waitinglist.feature`

```gherkin
Feature: Waitinglist

  Scenario: Visitor submits email to waitinglist
    Given I am on the landing page
    When I fill in the waitinglist email "test-waitinglist@example.com"
    And I submit the waitinglist form
    Then I should see a waitinglist success message

  Scenario: Admin views waitinglist entries
    Given I am logged in as an admin
    And I am on the org waitinglist page
    Then I should see the waitinglist table
```

### `apps/e2e/steps/waitinglist.steps.ts`

- "I am on the landing page" → `page.goto(process.env.COM_URL ?? 'http://localhost:5174')`
- "I fill in the waitinglist email {string}" → fill the email input in the waitinglist form. The locator depends on whether `WaitingList/index.svelte` renders a `<label>` — confirm during implementation and document in SKILL.md.
- "I submit the waitinglist form" → `page.getByRole('button', { name: /join waitinglist/i }).click()`
- "I should see a waitinglist success message" → `expect(page.getByText("You're on the list!")).toBeVisible()`
- "I am on the org waitinglist page" → `page.goto('/org/' + (process.env.E2E_ORG_SLUG ?? 'udemy-test') + '/waitinglist')` then await URL match
- "I should see the waitinglist table" → assert a `<table>` element is visible

> **Hydration:** The `classroomio-com` app uses SvelteKit SSR. Before interacting with the form, wait for evidence that JS has hydrated (e.g., `page.waitForLoadState('domcontentloaded')` plus waiting for the submit button to be enabled). The `html[theme]` signal used for the dashboard does NOT apply here — classroomio-com does not use Carbon's `<Theme>`. Identify the correct hydration signal during implementation and document it in SKILL.md.
>
> **Test email uniqueness:** The E2E test uses a fixed email (`test-waitinglist@example.com`). Since `reset-db` is non-fatal, use a timestamped email in the step definition as a fallback (`test-waitinglist-${Date.now()}@example.com`) to avoid 409 collisions on re-run.
>
> **Step reuse:** `"I am logged in as an admin"` is already defined in `course-creation.steps.ts` and is globally registered. Do not re-declare it in `waitinglist.steps.ts`.
>
> **`check-services.ts`:** Add a health check for classroomio-com at `http://localhost:5174` (or `process.env.COM_URL`) with a clear error message: `"classroomio-com not running — start with: pnpm dev --filter=@cio/classroomio-com"`.

---

## Environment Variables Summary

| App | Variable | Description |
|---|---|---|
| classroomio-com | `PUBLIC_SUPABASE_URL` | Supabase REST base URL (must match dashboard's Supabase project) |
| classroomio-com | `PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose) |
| e2e | `COM_URL` | Base URL for classroomio-com (default: `http://localhost:5174`) |
| e2e | `E2E_ORG_SLUG` | Org slug for admin tests (default: `udemy-test`) |

No new env vars required in `apps/dashboard` — it already has Supabase configured.
