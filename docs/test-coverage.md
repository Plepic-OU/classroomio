# Functional Test Coverage — ClassroomIO

> 2026-05-15 · 78 tests · 19 files · Jest (dashboard) + Playwright/Vitest (course-app)  
> Re-run: `apps/api/node_modules/.bin/tsx .claude/skills/coverage/extract.ts` then `/coverage`

## Summary

| Domain                | Status           | Tests |
|-----------------------|------------------|-------|
| Auth & Profiles       | ⚠ utilities only | 5     |
| Course Management     | ⚠ utilities only | 5     |
| Lesson Management     | ⚠ utilities only | 5     |
| Exercise & Grading    | ⚠ utilities only | 4     |
| Student Experience    | ✓ E2E + unit     | 14    |
| Organisation Admin    | ⚠ utilities only | 10    |
| Polls & Quizzes       | ⚠ utilities only | 6     |
| Billing               | ⚠ utilities only | 3     |
| Community             | ✗ none           | 0     |
| Analytics             | ✗ none           | 0     |
| Email & Notifications | ✗ none           | 0     |
| API Endpoints         | ✗ none           | 0     |
| Core Utilities        | ✓ unit           | 27    |

Status: `✓ unit` = logic paths covered · `✓ E2E` = end-to-end flows covered · `⚠ utilities only` = only pure helpers
tested, no flow/integration · `✗ none` = zero tests

---

## Covered Behaviours

### Auth & Profiles

- **`validateEmail.spec.js`** (Jest, 5 tests) — format checks: valid, invalid, empty, uppercase, special chars
- *Gap:* login/logout, signup, password reset, OAuth, email-verification flow, profile edit

### Course Management

- **`course.spec.ts`** (Jest, 3 tests) — `isCourseFreemium`: cost = 0, negative, NaN
- **`generateSlug.spec.js`** (Jest, 2 tests) — format (lowercase + hyphens), timestamp suffix
- *Gap:* create/edit/delete/publish/clone/price a course; course landing page

### Lesson Management

- **`formatYoutubeVideo.spec.ts`** (Jest, 5 tests) — embed URL normalisation, start-time params, embed-ID extraction
- *Gap:* lesson create/edit/delete, sections ordering, live-call URL, locking, multilingual content, attachments

### Exercise & Grading

- **`IsSubmissionEarly.spec.js`** (Jest, 4 tests) — submission vs due-date: early, same, late, both null
- *Gap:* question types, submission flow, teacher grading, AI grading, scoring, status transitions

### Student Experience

- **`course.spec.ts`** (Playwright, 6 tests) — initial load, sidebar navigation, dark mode, mobile sidebar, unpublished
  sections, back-link *(packages/course-app)*
- **`page.test.ts`** (Vitest, 2 tests) — page renders with correct class; data prop passed to Home
- **`page.server.test.ts`** (Vitest, 2 tests) — load function: success path, fetch error
- **`showAppsSideBar.spec.js`** (Jest, 4 tests) — sidebar visibility by URL path (lessons vs landingpage)
- *Gap:* enrollment, lesson-completion tracking, certificate download, attendance

### Organisation Admin

- **`org.spec.ts`** (Jest, 10 tests) — quiz-pin generation (random, range 100000–999999, uniqueness, integer type);
  site-name slugification (special chars, uppercase, empty input)
- *Gap:* member invite, role assignment, custom domain, org settings, billing plan gates

### Polls & Quizzes

- *(quiz-pin generation utility covered in `org.spec.ts` above)*
- *Gap:* poll creation/options, live quiz session lifecycle, poll submissions, vote tracking

### Billing

- **`getCurrencyFormatter.spec.ts`** (Jest, 3 tests) — `Intl.NumberFormat` locale for NGN, USD, EUR
- *Gap:* Polar checkout, subscription activation/deactivation, plan-gate enforcement

### Core Utilities

- **`date.spec.ts`** (Jest, 5) — time-diff calculation; greeting i18n key by hour-of-day
- **`string.spec.ts`** (Jest, 5) — capitalize: normal, empty, all-caps, non-alpha first char, sentence
- **`generateUUID.spec.ts`** (Jest, 4) — UUID format, uniqueness, valid/invalid detection
- **`genUniqueId.spec.js`** (Jest, 4) — ID: starts with letter, no special chars, uniqueness, time-based prefix
- **`isObject.spec.ts`** (Jest, 4) — type guard: empty obj, non-obj, nested obj, obj with props
- **`removeDuplicate.spec.js`** (Jest, 5) — dedup: normal array, empty, single, order preserved
- **`toggleMode.test.ts`** (Vitest, 4) — dark-mode body class: add, remove, empty input, preserve existing classes

---

## Untested Domains

- **Community** — Q&A questions/answers, course newsfeed posts/comments, reactions, votes
- **Analytics** — attendance reports, lesson-completion rates, submission statistics
- **Email & Notifications** — invitation, submission-graded, enrollment, and verification emails
- **API Endpoints** — all Hono routes: `POST /mail`, course CRUD, file pre-signing, KaTeX rendering
