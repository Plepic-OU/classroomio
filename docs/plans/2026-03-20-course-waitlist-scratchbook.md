# Scratchbook: Course Waiting List

> Design document: ./2026-03-20-course-waitlist-design.md
> Created: 2026-03-20

## Tasks

- [x] Task 1: Database migration — course columns, course_waitlist table, RLS policies, RPC functions
- [x] Task 2: Service functions — enrollment status, join/fetch/approve/remove waitlist in courses service
- [x] Task 3: Invite page — capacity check + waitlist join button + state display
- [x] Task 4: Course settings — enrollment section with max capacity + waitlist toggle
- [x] Task 5: People tab — inline waitlist section with approve/remove + capacity counter
- [x] Task 6: Email notifications — notification types + API routes
- [x] Task 7: Seed data — add waitlist-related seed data for E2E tests
- [x] Task 8: E2E tests — waitlist scenarios + step definitions

## Learnings

### Seed data for full-course testing
To test the waitlist invite flow, a course needs max_capacity=1, waitlist_enabled=true, and exactly 1 student enrolled. Used UPDATE + INSERT in seed.sql rather than modifying the existing course INSERT (which doesn't include the new columns).

### Step definition reuse across enrollment features
The "I navigate to the student invite link for course {string}" step from course-enrollment.steps.ts is automatically shared via the glob pattern in playwright config (`e2e/steps/**/*.steps.ts`). No need to duplicate it for waitlist tests.

## Status

Completed: 2026-03-20
