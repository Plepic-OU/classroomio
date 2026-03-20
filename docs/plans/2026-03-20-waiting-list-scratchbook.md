# Scratchbook: Waiting List Feature

Design document: [2026-03-20-waiting-list-design.md](./2026-03-20-waiting-list-design.md)

## Tasks

- [x] Task 1: Database migration — `supabase/migrations/20260320000000_waiting_list.sql`
- [x] Task 2: RPC functions — `supabase/migrations/20260320000001_waiting_list_functions.sql`
- [x] Task 3: TypeScript types — Course interface, defaultCourse, fetchCourse queries
- [x] Task 4: Course Settings UI — NumberInput, store, handleSave, setDefault, capacity warning
- [x] Task 5: Invite page — switched from addGroupMember to try_enroll_or_waitlist RPC
- [x] Task 6: Course Landing Page — PricingSection capacity check + "Join Waiting List" button
- [x] Task 7: People page — waitlist section with count, expand, remove per entry
- [x] Task 8: i18n — English keys added for settings, people, pricing, snackbar
- [x] Task 9: E2E test cleanup — waitinglist + max_capacity reset in global-setup.ts

## Learnings

- **Task 1**: Used `IF NOT EXISTS` / `IF EXISTS` guards in migration for idempotency — not in the design but safe practice
- **Task 3**: SLUG_QUERY (used by landing page) didn't include `group_id` — had to add it for PricingSection's capacity check
- **Task 4**: Settings store is a plain JS file (store.js, not .ts) — `max_capacity` added as null default alongside existing settings
- **Task 5**: The invite page import of `addGroupMember` was removed entirely — the RPC handles enrollment atomically. Teacher notification fetch moved after the RPC result check to avoid unnecessary queries on waitlist/closed results
- **Task 6**: PricingSection needs to fetch student count at mount time since SLUG_QUERY doesn't join groupmembers. Used a lightweight `select('*', { count: 'exact', head: true })` query
- **Task 7**: People page didn't import `course` store — had to add it for the waitlist query. Used `onMount` for the fetch since waitlist data is page-scoped
- **Task 9**: Reset ALL courses' max_capacity to null (not just test courses) since any seed course could be modified during tests. Also clean waitlist entries for the seed student profile specifically
