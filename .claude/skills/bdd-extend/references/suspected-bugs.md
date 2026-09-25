# Suspected bugs

Draft findings for human triage — **never** auto-filed as a GitHub issue, that's a human
call. Append one entry per suspected real app bug found while drafting a scenario: the
steps were correct, but the app didn't behave the way the flow implies it should.

A scenario left red because of an entry here should be tagged `@known-issue` and kept
(excluded from normal runs) rather than deleted, so it documents the gap instead of erasing
it.

## Entry format

```
### <short title>

- **Found:** <date>, drafting `<feature file path>`
- **Repro:** <numbered steps, or "run the tagged @known-issue scenario in <file>">
- **Expected:** <what the flow implies should happen>
- **Actual:** <what happened>
- **Evidence:** <path to a test-results/**/test-failed-*.png or trace.zip>
```

---

### Student invite link join is blocked by RLS

- **Found:** 2026-09-18, drafting `tests/e2e/features/courses/invite-student.feature`
- **Repro:** run the tagged `@known-issue` scenario:
  ```bash
  npx bddgen --config tests/e2e/playwright.config.ts --tags "@known-issue"
  npx playwright test --config tests/e2e/playwright.config.ts \
    --grep "Student joins a course via an invite link" --reporter=list --timeout=15000
  ```
  Or by hand: as a teacher, create a course, open its People tab, click Add, click "Copy
  Link" under "Invite Students" (the link is `invite/s/<base64 JSON of {id, name,
  description, orgSiteName}>`, generated client-side, not server-issued). As a *different*,
  not-yet-enrolled user, open that link and click "Join Course".
- **Expected:** the student is enrolled in the course and redirected away from the invite
  page (per the design doc's Wave 2 description, into `lms/mylearning`).
- **Actual:** clicking "Join Course" leaves the button stuck in a `loading` state
  (`"loading Join Course" [disabled]`) with no error shown to the user — the page never
  navigates away from `/invite/s/<hash>`. Two distinct bugs stack here, both worth fixing:
  1. **RLS blocks the lookup the join flow needs.** Network capture shows
     `GET /rest/v1/course?select=group_id&id=eq.<courseId>` returning **406** —
     `{"code":"PGRST116","details":"The result contains 0 rows",...,"message":"Cannot
     coerce the result to a single JSON object"}`. The `course` table's SELECT policy
     (`supabase/migrations/20250808030821_rls_secure_courses.sql:67-72`) is
     `using ((is_published OR is_user_in_course_group_or_admin(group_id)))` — it only
     blocks **unpublished** courses for a non-member, and a freshly-created course is
     unpublished by default (confirmed: publishing isn't part of the course-creation flow
     tested elsewhere in this suite). So this specifically breaks inviting a student to a
     course before publishing it, not the invite mechanism in general.
  2. **The app swallows the resulting error.** `apps/dashboard/src/routes/invite/s/[hash]/
     +page.svelte`'s `handleSubmit()` sets `loading = true`, then on
     `!courseData?.group_id` does `console.error(...); return;` (lines ~44-47) — `loading`
     is never reset to `false` and no `snackbar` message is shown (the store is already
     imported in this file for other error paths), so the user just sees a permanently
     spinning button with no explanation.
  Verified the student is never actually added: the course's People list stays empty after
  the click. Reproduced against a freshly-created course (not stale seed data), so it isn't
  a leftover-fixture artifact.
- **Evidence:** `test-results/features-courses-invite-st-*-chromium/test-failed-1.png` and
  `trace.zip` from the repro run above (path suffix varies by run — re-run to regenerate;
  `test-results/` is gitignored so nothing is committed here).

### Org settings shows "Update successful" even when the save fails

- **Found:** 2026-09-25, drafting `tests/e2e/features/org/settings.feature` (by reading the
  code, not from a failing run; the scenario passes, so there's no `@known-issue` tag)
- **Repro:** make the `organization` UPDATE fail (e.g. revoke the admin's update rights
  through RLS), then change the org name under Settings → Organization and click "Update
  Organization".
- **Expected:** only an error snackbar; the page keeps showing the old name.
- **Actual (from code):** `apps/dashboard/src/lib/components/Org/Settings/OrgSettings.svelte`
  `handleUpdate()` updates the `currentOrg` store, calls
  `snackbar.success('...update_successful')` and sets `hasUnsavedChanges = false`, and only
  *then* runs `if (error) throw error`. The user sees a success message, followed by an
  error message, and the UI keeps showing a name that was never saved (until reload).
- **Evidence:** code inspection, `OrgSettings.svelte` around lines 116-128.
