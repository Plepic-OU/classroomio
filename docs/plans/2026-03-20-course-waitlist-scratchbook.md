# Course Waiting List — Implementation Scratchbook

> Design doc: docs/plans/2026-03-20-course-waitlist-design.md

## Tasks

- [x] Task 1: Database migration
- [x] Task 2: TypeScript types
- [x] Task 3: Course Settings UI (enrollment section + store + i18n)
- [x] Task 4: Invite page (capacity check + waitlist join flow)
- [x] Task 5: People tab (waitlist section + approve action)
- [x] Task 6: Email routes (3 endpoints + notification service)

## Learnings

- Layout server never queries `course` table (data comes from base64 hash), so `+page.server.ts` needs its own `course` query for `max_capacity`/`waitlist_enabled`. Design's "extend existing fetch" note was incorrect — separate query is the right approach.
