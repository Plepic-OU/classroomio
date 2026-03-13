# Functionality Test Coverage Report
_Generated: 2026-03-13T08:23:26Z_
_Dashboard test runner: Jest | API test runner: Vitest_

---

## Test Run Results

| App | Passed | Failed | Skipped | Total |
|-----|--------|--------|---------|-------|
| Dashboard (`@cio/dashboard`) | 63 | 0 | 0 | 63 |
| API (`@cio/api`) | — | — | — | **No test files** |

All 63 dashboard tests pass. The API has a Vitest configuration but no test files yet.

---

## Coverage Summary

> **Coverage % = (Tested + 0.5 × Partial) / Total features**
> A "feature" = one logical unit: a utility module, a service, an API endpoint, or a UI component area.

| Feature Domain | Features | ✅ Tested | ⚠️ Partial | ❌ Not Tested | Coverage |
|----------------|----------|-----------|------------|--------------|----------|
| Auth & Profiles | 8 | 1 | 0 | 7 | 13% |
| Organization | 7 | 1 | 0 | 6 | 14% |
| Course Management | 12 | 1 | 1 | 10 | 13% |
| Assessment | 8 | 1 | 0 | 7 | 13% |
| AI Features | 4 | 0 | 0 | 4 | 0% |
| Community & Social | 5 | 0 | 0 | 5 | 0% |
| Apps (Polls & Quiz) | 3 | 0 | 0 | 3 | 0% |
| Billing | 3 | 0 | 0 | 3 | 0% |
| Email Notifications | 11 | 0 | 0 | 11 | 0% |
| File & Media | 6 | 0 | 0 | 6 | 0% |
| Utility Functions | 22 | 8 | 1 | 13 | 38% |
| Navigation & Layout | 6 | 1 | 0 | 5 | 17% |
| **Total** | **95** | **13** | **2** | **80** | **15%** |

> **Overall: 15% functionality coverage.** Only pure utility helpers have meaningful tests. All services, API endpoints, and UI components have zero test coverage.

---

## Feature Coverage Detail

### Auth & Profiles

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| Email validation | `utils/functions/validateEmail.js` | `validateEmail.spec.js` | ✅ Tested | valid/invalid email formats (5 cases) |
| User helpers | `utils/functions/user.ts` | — | ❌ Not tested | — |
| Logout | `utils/functions/logout.ts` | — | ❌ Not tested | — |
| Permissions | `utils/functions/permissions.ts` | — | ❌ Not tested | — |
| Supabase client | `utils/functions/supabase.ts` | — | ❌ Not tested | — |
| Supabase server client | `utils/functions/supabase.server.ts` | — | ❌ Not tested | — |
| Auth middleware | `utils/services/middlewares/authentication.server.ts` | — | ❌ Not tested | — |
| AuthUI component | `lib/components/AuthUI/` | — | ❌ Not tested | — |

**Untested pages:** `login`, `signup`, `forgot`, `reset`, `logout`, `onboarding`, `verify-email-error`, `profile/[id]`

---

### Organization

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| Org utilities (PIN, sitename) | `utils/functions/org.ts` | `org.spec.ts` | ✅ Tested | Quiz PIN generation (6 cases), sitename slug generation (4 cases) |
| Domain utilities | `utils/functions/domain.ts` | — | ❌ Not tested | — |
| Org service | `utils/services/org/index.ts` | — | ❌ Not tested | — |
| Org domain service | `utils/services/org/domain.ts` | — | ❌ Not tested | — |
| Dashboard service | `utils/services/dashboard/index.ts` | — | ❌ Not tested | — |
| Org component | `lib/components/Org/` | — | ❌ Not tested | — |
| OrgSelector component | `lib/components/OrgSelector/` | — | ❌ Not tested | — |

**Untested API endpoints:** `api/org/audience`, `api/org/team`, `api/domain`, `api/admin/cleanup-tokens`, `api/admin/security-monitor`

**Untested pages:** `home`, `org/[slug]`, `org/[slug]/audience/[...params]`, `org/[slug]/settings/*` (4 sub-pages), `org/[slug]/setup`, `onboarding`

---

### Course Management

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| Free course detection | `utils/functions/course.ts` | `course.spec.ts` | ✅ Tested | Free course detection for cost=0, negative, NaN (3 cases) |
| Slug generation | `utils/functions/generateSlug.js` | `generateSlug.spec.js` | ⚠️ Partial | Slug format, timestamp suffix (2 cases — missing: edge cases, unicode, max length) |
| Courses service | `utils/services/courses/index.ts` | — | ❌ Not tested | — |
| Course presign service | `utils/services/courses/presign.ts` | — | ❌ Not tested | — |
| LMS exercises service | `utils/services/lms/exercises.ts` | — | ❌ Not tested | — |
| API: course CRUD | `apps/api/src/routes/course/course.ts` | — | ❌ Not tested | — |
| API: lesson CRUD | `apps/api/src/routes/course/lesson.ts` | — | ❌ Not tested | — |
| API: course clone | `apps/api/src/routes/course/clone.ts` + `services/course/clone.ts` | — | ❌ Not tested | — |
| Course component | `lib/components/Course/` | — | ❌ Not tested | — |
| Courses list component | `lib/components/Courses/` | — | ❌ Not tested | — |
| CourseLandingPage component | `lib/components/CourseLandingPage/` | — | ❌ Not tested | — |
| LMS component | `lib/components/LMS/` | — | ❌ Not tested | — |

**Untested API endpoints:** `api/courses/data`, `api/courses/exercises`, `api/courses/newsfeed`

**Untested pages:** `courses/[id]`, `courses/[id]/lessons`, `courses/[id]/lessons/[...lessonParams]`, `courses/[id]/settings`, `courses/[id]/landingpage`, `courses/[id]/certificates`, `course/[slug]`, `invite/s/[hash]`, `invite/t/[hash]`

---

### Assessment

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| Submission timing | `utils/functions/isSubmissionEarly.js` | `IsSubmissionEarly.spec.js` | ✅ Tested | Early/late/null submission timing (4 cases) |
| Marks service | `utils/services/marks/index.ts` | — | ❌ Not tested | — |
| Submissions service | `utils/services/submissions/index.ts` | — | ❌ Not tested | — |
| Question component | `lib/components/Question/` | — | ❌ Not tested | — |
| QuestionContainer component | `lib/components/QuestionContainer/` | — | ❌ Not tested | — |
| Progress component | `lib/components/Progress/` | — | ❌ Not tested | — |

**Untested API endpoints:** `api/courses/analytics`, `api/courses/marks`, `api/courses/submission`, `api/courses/submissions`

**Untested pages:** `courses/[id]/marks`, `courses/[id]/submissions`, `courses/[id]/analytics`, `courses/[id]/attendance`, `courses/[id]/people`, `courses/[id]/people/[personId]`, `lms/exercises`

---

### AI Features

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| AI completion route | `routes/api/completion/+server.ts` | — | ❌ Not tested | — |
| Custom AI prompt | `routes/api/completion/customprompt/+server.ts` | — | ❌ Not tested | — |
| Exercise AI prompt | `routes/api/completion/exerciseprompt/+server.ts` | — | ❌ Not tested | — |
| Grading AI prompt | `routes/api/completion/gradingprompt/+server.ts` | — | ❌ Not tested | — |
| AI component | `lib/components/AI/` | — | ❌ Not tested | — |

---

### Community & Social

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| Newsfeed service | `utils/services/newsfeed/index.ts` | — | ❌ Not tested | — |
| Notification service | `utils/services/notification/notification.ts` | — | ❌ Not tested | — |
| Newsfeed API endpoint | `routes/api/courses/newsfeed/+server.ts` | — | ❌ Not tested | — |
| Vote component | `lib/components/Vote/` | — | ❌ Not tested | — |
| Snackbar component | `lib/components/Snackbar/` | — | ❌ Not tested | — |

**Untested pages:** `lms/community`, `lms/community/[slug]`, `lms/community/ask`, `org/[slug]/community/*` (3 sub-pages), `lms/explore`, `lms/mylearning`

---

### Apps (Polls & Quiz)

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| Apps component (Polls UI) | `lib/components/Apps/` | — | ❌ Not tested | — |
| Quiz page | `routes/org/[slug]/quiz/+page.svelte` | — | ❌ Not tested | — |
| Quiz detail page | `routes/org/[slug]/quiz/[slug]/+page.svelte` | — | ❌ Not tested | — |

---

### Billing

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| Polar portal | `routes/api/polar/portal/+server.ts` | — | ❌ Not tested | — |
| Polar subscribe | `routes/api/polar/subscribe/+server.ts` | — | ❌ Not tested | — |
| Polar webhook | `routes/api/polar/webhook/+server.ts` | — | ❌ Not tested | — |

**Untested pages:** `upgrade`

---

### Email Notifications

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| Welcome email | `routes/api/email/welcome/+server.ts` | — | ❌ Not tested | — |
| Invite email | `routes/api/email/invite/+server.ts` | — | ❌ Not tested | — |
| Email verification | `routes/api/email/verify_email/+server.ts` | — | ❌ Not tested | — |
| Newsfeed email | `routes/api/email/course/newsfeed/+server.ts` | — | ❌ Not tested | — |
| Student welcome email | `routes/api/email/course/student_welcome/+server.ts` | — | ❌ Not tested | — |
| Student payment proof email | `routes/api/email/course/student_prove_payment/+server.ts` | — | ❌ Not tested | — |
| Teacher welcome email | `routes/api/email/course/teacher_welcome/+server.ts` | — | ❌ Not tested | — |
| Teacher: student joined email | `routes/api/email/course/teacher_student_joined/+server.ts` | — | ❌ Not tested | — |
| Teacher: student purchase email | `routes/api/email/course/teacher_student_buycourse/+server.ts` | — | ❌ Not tested | — |
| Submission update email | `routes/api/email/course/submission_update/+server.ts` | — | ❌ Not tested | — |
| Exercise submission email | `routes/api/email/course/exercise_submission_update/+server.ts` | — | ❌ Not tested | — |
| Mail service (API) | `apps/api/src/services/mail.ts` + `routes/mail.ts` | — | ❌ Not tested | — |

---

### File & Media

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| File validation | `utils/functions/fileValidation.ts` | — | ❌ Not tested | — |
| File presign (dashboard) | `utils/services/courses/presign.ts` | — | ❌ Not tested | — |
| File presign (API) | `apps/api/src/routes/course/presign.ts` | — | ❌ Not tested | — |
| KaTeX rendering (API) | `apps/api/src/routes/course/katex.ts` | — | ❌ Not tested | — |
| Unsplash image search | `routes/api/unsplash/+server.ts` | — | ❌ Not tested | — |
| UploadWidget component | `lib/components/UploadWidget/` | — | ❌ Not tested | — |

---

### Utility Functions

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| String helpers | `utils/functions/string.ts` | `string.spec.ts` | ✅ Tested | capitalize (5 cases) |
| Date helpers | `utils/functions/date.ts` | `date.spec.ts` | ✅ Tested | calDateDiff, getGreeting (5 cases) |
| YouTube URL formatter | `utils/functions/formatYoutubeVideo.ts` | `formatYoutubeVideo.spec.ts` | ✅ Tested | embed URL, watch URL with timestamp (5 cases) |
| Unique ID generator | `utils/functions/genUniqueId.js` | `genUniqueId.spec.js` | ✅ Tested | format, uniqueness (4 cases) |
| UUID generator | `utils/functions/generateUUID.ts` | `generateUUID.spec.ts` | ✅ Tested | format, uniqueness, validation (4 cases) |
| Currency formatter | `utils/functions/getCurrencyFormatter.ts` | `getCurrencyFormatter.spec.ts` | ✅ Tested | NGN, USD, EUR (3 cases) |
| Object type check | `utils/functions/isObject.ts` | `isObject.spec.ts` | ✅ Tested | empty obj, non-obj, nested (4 cases) |
| Array deduplication | `utils/functions/removeDuplicate.js` | `removeDuplicate.spec.js` | ✅ Tested | duplicates, empty, single (5 cases) |
| Slug generator | `utils/functions/generateSlug.js` | `generateSlug.spec.js` | ⚠️ Partial | basic format, timestamp (2 cases only) |
| HTTP API helpers | `utils/functions/api.js` | — | ❌ Not tested | — |
| App bootstrap helpers | `utils/functions/app.js` | — | ❌ Not tested | — |
| App setup | `utils/functions/appSetup.ts` | — | ❌ Not tested | — |
| Date formatter | `utils/functions/formatDate.js` | — | ❌ Not tested | — |
| UUID validator | `utils/functions/isUUID.ts` | — | ❌ Not tested | — |
| Number helpers | `utils/functions/number.ts` | — | ❌ Not tested | — |
| HTML sanitizer | `utils/functions/sanitize.ts` | — | ❌ Not tested | — |
| Theme helpers | `utils/functions/theme.ts` | — | ❌ Not tested | — |
| TinyMCE plugins | `utils/functions/tinymce/plugins.ts` | — | ❌ Not tested | — |
| HTML converter | `utils/functions/toHtml.ts` | — | ❌ Not tested | — |
| i18n translations | `utils/functions/translations.ts` | — | ❌ Not tested | — |
| Try/catch wrapper | `utils/functions/trycatch.ts` | — | ❌ Not tested | — |
| Form validator | `utils/functions/validator.ts` | — | ❌ Not tested | — |

---

### Navigation & Layout

| Feature | Source | Test File | Status | What's Tested |
|---------|--------|-----------|--------|---------------|
| Sidebar visibility | `utils/functions/showAppsSideBar.js` | `showAppsSideBar.spec.js` | ✅ Tested | lesson/landingpage path detection (4 cases) |
| Route helper | `utils/functions/routes/dashboard.ts` | — | ❌ Not tested | — |
| Hide nav by route | `utils/functions/routes/hideNavByRoute.ts` | — | ❌ Not tested | — |
| Public route check | `utils/functions/routes/isPublicRoute.js` | — | ❌ Not tested | — |
| Auth redirect logic | `utils/functions/routes/shouldRedirectOnAuth.ts` | — | ❌ Not tested | — |
| Navigation component | `lib/components/Navigation/` | — | ❌ Not tested | — |

---

## Gaps by Priority

### 🔴 High Priority — Core user flows with zero test coverage

These are the most critical paths through the application that have no tests at all.

- **Course enrollment flow** — `utils/services/courses/index.ts`, `routes/api/courses/data` — a student joining a course has no guard tests
- **Exercise submission** — `utils/services/submissions/index.ts`, `routes/api/courses/submission` — the primary student action has no tests
- **Grading / marks** — `utils/services/marks/index.ts`, `routes/api/courses/marks` — grade writing is irreversible; no tests
- **Authentication middleware** — `utils/services/middlewares/authentication.server.ts` — auth guard logic protecting all server routes has no tests
- **API route handlers** (Hono) — `apps/api/src/routes/course/course.ts`, `lesson.ts`, `clone.ts` — the entire Hono API has zero tests
- **Email delivery** — `apps/api/src/services/mail.ts` — broken email = invisible to users; no tests
- **Billing webhooks** — `routes/api/polar/webhook/+server.ts` — financial event processing has no tests

### 🟡 Medium Priority — Supporting features with no tests

- **Org management service** — `utils/services/org/index.ts` — org settings writes affect all members
- **Notification service** — `utils/services/notification/notification.ts` — in-app notifications
- **Newsfeed service** — `utils/services/newsfeed/index.ts` — course announcements
- **File presign logic** — `utils/services/courses/presign.ts`, `apps/api/src/routes/course/presign.ts` — upload URL signing
- **Slug generator edge cases** — `utils/functions/generateSlug.js` currently ⚠️ Partial; missing unicode, max-length, collision cases
- **Auth redirect logic** — `utils/functions/routes/shouldRedirectOnAuth.ts` — determines where unauthenticated users land
- **Form validator** — `utils/functions/validator.ts` — used across multiple forms
- **HTML sanitizer** — `utils/functions/sanitize.ts` — XSS prevention; security-sensitive

### 🟢 Low Priority — Infrastructure / internal utilities

- Store files (`utils/store/*.ts`) — Svelte stores are hard to unit test in isolation; integration tests more appropriate
- Type definitions (`utils/types/*.ts`) — compile-time only, no runtime logic
- Constants (`utils/constants/*.ts`) — static values, low ROI
- TinyMCE plugin config (`utils/functions/tinymce/plugins.ts`) — third-party config
- Posthog / Sentry integrations — analytics/monitoring, acceptable to skip unit tests

---

## What Would Good Coverage Look Like?

Each journey below currently has **no tests at all**. These are the test files worth writing first.

1. **Student enrolls in a course**
   - Unit: `utils/services/courses/index.ts` — test enrollment validation, duplicate prevention
   - Integration: `routes/api/courses/data/+server.ts` — test response shape and auth guard

2. **Educator creates and publishes a course**
   - Unit: `utils/functions/course.ts` — extend existing tests with publish validation, slug uniqueness
   - Integration: `apps/api/src/routes/course/course.ts` — test create/update/delete handlers

3. **Student submits an exercise**
   - Unit: `utils/services/submissions/index.ts` — test submission creation, due-date enforcement
   - Integration: `routes/api/courses/submission/+server.ts` — test auth guard, response codes

4. **Educator grades a submission**
   - Unit: `utils/services/marks/index.ts` — test grade write, total calculation
   - Integration: `routes/api/courses/marks/+server.ts` — test auth guard, role check (teacher-only)

5. **User authentication and redirect**
   - Unit: `utils/functions/routes/shouldRedirectOnAuth.ts` — test each redirect scenario
   - Unit: `utils/services/middlewares/authentication.server.ts` — test JWT validation, missing token

6. **Email notifications are sent**
   - Unit: `apps/api/src/services/mail.ts` — test template rendering, recipient selection
   - Integration: `routes/api/email/course/student_welcome/+server.ts` — test trigger conditions

7. **Course is cloned**
   - Unit: `apps/api/src/services/course/clone.ts` — test deep-copy logic, ID regeneration
   - Integration: `apps/api/src/routes/course/clone.ts` — test auth guard, input validation

8. **File is uploaded**
   - Unit: `utils/functions/fileValidation.ts` — test type/size restrictions
   - Integration: `apps/api/src/routes/course/presign.ts` — test presigned URL generation, bucket selection
