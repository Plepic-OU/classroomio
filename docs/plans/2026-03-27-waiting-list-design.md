# Waiting List — Design Document

**Date:** 2026-03-27
**Scope:** Allow landing page visitors to join a waitinglist. Admins can view org-specific entries in the dashboard.
**Maturity:** MVP
**Goal:** Capture interest from visitors before they sign up; give admins visibility into demand.

---

## Decisions

| Topic | Decision |
|---|---|
| DB | `waitinglist` table exists. Add `org_id` column + drop/replace unique constraint + add RLS policies. |
| Waitinglist scope | **Per-org** — `org_id uuid REFERENCES organization(id)` (nullable). Landing page submits with null. |
| Landing page submission | **Direct browser call** to Supabase REST — no `+server.ts` proxy (anon key is public by design) |
| Dashboard data loading | **Client-side `onMount`** in `+page.svelte` — consistent with rest of dashboard; no `+page.server.ts` |
| DB email validation | **RLS `WITH CHECK`** validates email format via regex |
| Supabase access (landing) | Anon key — safe to expose; INSERT-only policy added for `anon` role |
| Supabase access (dashboard) | `getSupabase()` client-side in `onMount`; authenticated SELECT RLS policy scoped by org membership |
| Form placement | Hero section of classroomio-com, below existing CTA buttons |
| Success state | Inline "You're on the list!" message replaces the form |
| Dashboard location | New page `/org/[slug]/waitinglist`, linked from org sidebar |
| Duplicate handling | `UNIQUE(email, org_id)` constraint; 23505 Postgres error code maps to "Already signed up" message |
| Unique constraint on nulls | `UNIQUE(email, org_id)` — null != null in PostgreSQL, so duplicate null-org entries are possible but acceptable for MVP |
| Pagination | None — simple table for MVP (Supabase default max_rows is 1000; acceptable for MVP) |
| Email notification | None — out of scope for MVP |
| Rate limiting | None — accepted MVP risk |
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

-- 1. Add org_id column (nullable — landing page entries have no org context)
ALTER TABLE public.waitinglist
  ADD COLUMN org_id uuid REFERENCES public.organization(id) ON DELETE SET NULL;

-- 2. Drop the old email-only unique constraint (poor name, wrong scope)
ALTER TABLE public.waitinglist
  DROP CONSTRAINT "constraint_name";

-- 3. New unique constraint: same email can appear once per org (and once as null-org)
--    Note: NULL != NULL in PostgreSQL, so duplicate null-org entries are theoretically possible;
--    acceptable for MVP since the landing page is not the primary per-org use case.
ALTER TABLE public.waitinglist
  ADD CONSTRAINT waitinglist_email_org_unique UNIQUE (email, org_id);

-- 4. Allow anonymous visitors to insert — with email format validation
CREATE POLICY "anon can insert waitinglist"
  ON public.waitinglist
  FOR INSERT
  TO anon
  WITH CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- 5. Allow authenticated users to read entries for their orgs (or null-org entries)
CREATE POLICY "authenticated can select own org waitinglist"
  ON public.waitinglist
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.organizationmember om
      JOIN public.profile p ON p.id = om.profile_id
      WHERE p.auth_user_id = auth.uid()
        AND om.organization_id = waitinglist.org_id
    )
  );
```

> **Rollback:**
> ```sql
> DROP POLICY "anon can insert waitinglist" ON public.waitinglist;
> DROP POLICY "authenticated can select own org waitinglist" ON public.waitinglist;
> ALTER TABLE public.waitinglist DROP CONSTRAINT waitinglist_email_org_unique;
> ALTER TABLE public.waitinglist ADD CONSTRAINT "constraint_name" UNIQUE (email);
> ALTER TABLE public.waitinglist DROP COLUMN org_id;
> ```

---

## File Changes

### New files

```
supabase/migrations/20260327000000_waitinglist_rls.sql

apps/classroomio-com/src/
  lib/WaitingList/index.svelte

apps/dashboard/src/routes/org/[slug]/
  waitinglist/+page.svelte

apps/e2e/
  features/waitinglist.feature
  steps/waitinglist.steps.ts
```

### Modified files

```
apps/classroomio-com/src/lib/Home/Hero.svelte              ← embed WaitingListForm below CTA buttons
apps/classroomio-com/.env.example                          ← add PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY
apps/dashboard/src/lib/components/Org/SideBar.svelte       ← add Waitinglist nav item (admin only)
apps/dashboard/src/lib/utils/constants/translations/en.json  ← add waitinglist key
  (+ da, de, es, fr, hi, pl, pt, ru, vi)
apps/e2e/scripts/check-services.ts                         ← add port 5174 health check
apps/e2e/scripts/reset-db.ts                               ← no change needed (supabase db reset handles it)
```

---

## Landing Page

### `apps/classroomio-com/src/lib/WaitingList/index.svelte`

Self-contained component with three UI states:

- **Default**: email input (using `$lib/Input/TextField.svelte`) + "Join Waitinglist" button (using `$lib/Button/Button.svelte`)
- **Success**: inline "You're on the list!" replaces the form
- **Error**: inline `<p class="text-red-500">` — message by status:
  - Postgres error code `23505` in response body → "You're already signed up!"
  - other → "Something went wrong, please try again."

Client-side validation: non-empty + regex `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` before submitting. On invalid, show "Please enter a valid email."

**Supabase call (direct from browser):**

```js
const res = await fetch(`${PUBLIC_SUPABASE_URL}/rest/v1/waitinglist`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': PUBLIC_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
    'Prefer': 'return=minimal',
  },
  body: JSON.stringify({ email }),
  signal: AbortSignal.timeout(5000),
});
```

- `org_id` is not included in the body — null by default for landing page entries.
- On `res.ok` (201): show success state.
- On 409 OR response body contains `"23505"`: show duplicate message.
- Other: show generic error.

Import `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` from `$env/static/public`.

The form should match the Hero section's centering (`flex flex-col items-center justify-center`).

### Hero placement

In `Hero.svelte`, below the existing CTA buttons `<div>` (contains "Book a demo" and "Sign Up for Free"), add:

```svelte
import WaitingListForm from '$lib/WaitingList/index.svelte';
...
<WaitingListForm />
```

### `.env.example` addition

```
PUBLIC_SUPABASE_URL=http://localhost:54321
PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>
```

---

## Dashboard

### `apps/dashboard/src/routes/org/[slug]/waitinglist/+page.svelte`

No `+page.server.ts` — data loaded client-side in `onMount`.

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { getSupabase } from '$lib/utils/functions/supabase';
  import { currentOrg } from '$lib/utils/store/org';

  let entries: { email: string; created_at: string }[] = [];
  let isLoading = true;

  onMount(async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('waitinglist')
      .select('email, created_at')
      .eq('org_id', $currentOrg.id)
      .order('created_at', { ascending: false });
    entries = data ?? [];
    isLoading = false;
  });
</script>
```

Page layout:
- Heading "Waitinglist"
- Count: "X people signed up" (or loading skeleton)
- Table: **Email** | **Signed up** (locale date string via `new Date(entry.created_at).toLocaleDateString()`)
- Empty state: "No one on the waitinglist yet."

### Sidebar

In `SideBar.svelte`, add a "Waitinglist" nav item:
- Only visible when `$isOrgAdmin` is true
- Link: `$currentOrgPath + '/waitinglist'`
- Label: `$t('org_navigation.waitinglist')`
- Icon: `List` from `carbon-icons-svelte` — add `{:else if menuItem.path === '/waitinglist'}` branch to the icon block

Translation key `"waitinglist": "Waitinglist"` added to **all 10** translation files.

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

- "I am on the landing page" → `page.goto(process.env.COM_URL ?? 'http://localhost:5174')`; wait for page to be interactive before interacting
- "I fill in the waitinglist email {string}" → fill the email TextField (confirm exact label/placeholder from component and document in SKILL.md)
- "I submit the waitinglist form" → `page.getByRole('button', { name: /join waitinglist/i }).click()`
- "I should see a waitinglist success message" → `expect(page.getByText("You're on the list!")).toBeVisible()`
- "I am on the org waitinglist page" → `page.goto(\`/org/${process.env.E2E_ORG_SLUG ?? 'udemy-test'}/waitinglist\`)` + `expect(page).toHaveURL(/waitinglist/)`
- "I should see the waitinglist table" → `expect(page.locator('table')).toBeVisible()`

> **Hydration:** classroomio-com does not use Carbon `<Theme>`, so `html[theme]` does not apply. Determine correct hydration signal during implementation and document in SKILL.md.
>
> **Step reuse:** `"I am logged in as an admin"` is globally registered from `course-creation.steps.ts` — do not re-declare.
>
> **`check-services.ts`:** Add health check for `process.env.COM_URL ?? 'http://localhost:5174'` with message: `"classroomio-com not running — start with: pnpm dev --filter=@cio/classroomio-com"`.

---

## Environment Variables Summary

| App | Variable | Description |
|---|---|---|
| classroomio-com | `PUBLIC_SUPABASE_URL` | Supabase REST base URL (same project as dashboard) |
| classroomio-com | `PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose) |
| e2e | `COM_URL` | classroomio-com base URL (default: `http://localhost:5174`) |
| e2e | `E2E_ORG_SLUG` | Org slug for admin tests (default: `udemy-test`) |

No new env vars required in `apps/dashboard`.
