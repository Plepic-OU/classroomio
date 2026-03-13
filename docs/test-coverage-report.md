# Functionality Test Coverage Report

> Generated: 2026-03-13
> Test frameworks: Jest (Dashboard), Vitest (API, Course App), Cypress (E2E)

## Summary

| App | Total Modules | Modules With Tests | Functionality Coverage |
|-----|--------------|-------------------|----------------------|
| Dashboard | 69 | 14 | 22/100+ functionalities |
| API | 37 | 0 | 0/37 modules |
| Course App | 72 | 1 (demo only) | 0 real functionalities |
| E2E (Cypress) | — | 1 scenario file | 3 scenarios |

### Test Results Summary

- **Dashboard**: 14 test suites, 63 tests — all passing
- **API**: No test files found
- **Course App**: 1 test suite (demo placeholder), 1 test — passing
- **E2E (Cypress)**: Not executed (requires running app on localhost:4173)

---

## Dashboard (`apps/dashboard`)

### Utility Functions (`src/lib/utils/functions/`)

#### `course.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `isCourseFree()` | Yes | `course.spec.ts` — "Should return True when cost is 0" + 2 more |
| `getStudentInviteLink()` | No | — |
| `replaceHTMLTag()` | No | — |
| `calcCourseDiscount()` | No | — |

Coverage: 47% statements, 20% functions

#### `date.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `calDateDiff()` | Yes | `date.spec.ts` — "should return the correct time difference..." (2 tests) |
| `getGreeting()` | Yes | `date.spec.ts` — "should return morning i18n key..." + 2 more |

Coverage: 100% statements, 100% functions

#### `formatYoutubeVideo.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `formatYoutubeVideo()` | Yes | `formatYoutubeVideo.spec.ts` — "should return the same url when given a valid youtube embed url" + 1 more |
| `getEmbedId()` | Yes | `formatYoutubeVideo.spec.ts` — "should return the correct embed id..." + 2 more |

Coverage: 68% statements, 100% functions (some branches uncovered)

#### `org.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `genQuizPin()` | Yes | `org.spec.ts` — "should return a random 6-digit pin" + 5 more |
| `generateSitename()` | Yes | `org.spec.ts` — "should return slug-like string" + 3 more |
| `openUpgradeModal()` | No | — |

Coverage: 67% statements, 67% functions

#### `string.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `capitalizeFirstLetter()` | Yes | `string.spec.ts` — "should return the same string with the first letter capitalized" + 4 more |

Coverage: 100% statements, 100% functions

#### `generateUUID.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `generateUUID()` | Yes | `generateUUID.spec.ts` — "should be true when tested with the uuid function" + 1 more |

Coverage: 100% statements, 100% functions

#### `isUUID.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `isUUID()` | Yes | `generateUUID.spec.ts` — "should return true for a valid UUID" + 1 more |

Coverage: 100% statements, 100% functions

#### `getCurrencyFormatter.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `getCurrencyFormatter()` | Yes | `getCurrencyFormatter.spec.ts` — "should return a new instance of Intl.NumberFormat..." (NGN, USD, EUR) |

Coverage: 100% statements, 100% functions

#### `isObject.ts`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `isObject()` | Yes | `isObject.spec.ts` — "should return true for an empty object" + 3 more |

Coverage: 100% statements, 100% functions

#### `genUniqueId.js`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `genUniqueId()` | Yes | `genUniqueId.spec.js` — "should start with letter" + 3 more |

Coverage: 100% statements, 100% functions

#### `generateSlug.js`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `generateSlug()` | Yes | `generateSlug.spec.js` — "should return a string with lowercase letters and hyphens..." + 1 more |

Coverage: 100% statements, 100% functions (0% branch due to optional param)

#### `isSubmissionEarly.js`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `isSubmissionEarly()` | Yes | `IsSubmissionEarly.spec.js` — "should return true when createdAt is earlier than dueDate" + 3 more |

Coverage: 100% statements, 100% functions

#### `removeDuplicate.js`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `removeDuplicate()` | Yes | `removeDuplicate.spec.js` — "should remove duplicate elements of an array" + 4 more |

Coverage: 100% statements, 100% functions

#### `showAppsSideBar.js`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `showAppsSideBar()` | Yes | `showAppsSideBar.spec.js` — "should return true when path includes '/lessons/'" + 3 more |

Coverage: 100% statements, 100% functions

#### `validateEmail.js`

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `validateEmail()` | Yes | `validateEmail.spec.js` — "should return true for a valid email format" + 4 more |

Coverage: 100% statements, 100% functions

#### `domain.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `sanitizeDomain()` | No | — |
| `sendDomainRequest()` | No | — |

#### `fileValidation.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `validateImageType()` | No | — |
| `validateImageExtension()` | No | — |
| `validateImageUpload()` | No | — |
| `sanitizeFilename()` | No | — |

#### `sanitize.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `sanitizeHtml()` | No | — |
| `stripHtml()` | No | — |
| `escapeHtml()` | No | — |
| `sanitizeUrl()` | No | — |

#### `validator.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `saveCertificateValidation()` | No | — |
| `getConfirmPasswordError()` | No | — |
| `processErrors()` | No | — |
| `authValidation()` | No | — |
| `lessonValidation()` | No | — |
| `coursePaymentValidation()` | No | — |
| `resetValidation()` | No | — |
| `forgotValidation()` | No | — |
| `orgLandingpageValidation()` | No | — |
| `onboardingValidation()` | No | — |
| `updateProfileValidation()` | No | — |
| `createNewsfeedValidation()` | No | — |
| `addNewsfeedCommentValidation()` | No | — |
| `createOrgValidation()` | No | — |
| `updateOrgNameValidation()` | No | — |
| `updateOrgSiteNameValidation()` | No | — |
| `updateProfileEmailValidation()` | No | — |
| `createQuizValidation()` | No | — |
| `askCommunityValidation()` | No | — |
| `commentInCommunityValidation()` | No | — |
| `getDisableSubmit()` | No | — |
| `validateEmailInString()` | No | — |

#### `permissions.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `checkUserCoursePermissions()` | No | — |

#### `toHtml.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `isHtmlValueEmpty()` | No | — |
| `getTextFromHTML()` | No | — |

#### `theme.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `setTheme()` | No | — |
| `setCustomTheme()` | No | — |
| `injectCustomTheme()` | No | — |

#### `translations.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `handleLocaleChange()` | No | — |
| `lessonFallbackNote()` | No | — |
| `loadTranslations()` | No | — |

#### `number.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `calcPercentageWithRounding()` | No | — |

#### `trycatch.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `tc()` | No | — |

#### `logout.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `logout()` | No | — |

#### `user.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `getProfile()` | No | — |

#### `appSetup.ts` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `setupAnalytics()` | No | — |
| `getProfile()` | No | — |

#### `app.js` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `toggleBodyByMode()` | No | — |
| `isCoursesPage()` | No | — |
| `isCoursePage()` | No | — |
| `isOrgPage()` | No | — |
| `isQuizPage()` | No | — |
| `isLMSPage()` | No | — |

#### `api.js` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| `handleAuthChange()` | No | — |

#### `formatDate.js` — No Tests

| Functionality | Covered | Test Reference |
|--------------|---------|----------------|
| default export (date formatter) | No | — |

### Services (`src/lib/utils/services/`) — No Tests

All 21 service files have zero test coverage.

| Module | Key Exports |
|--------|------------|
| `api/index.ts` | API client setup (hcWithType) |
| `api/utils.ts` | API utility functions |
| `api/constants.ts` | API constants |
| `api/types.ts` | API type definitions |
| `attendance/index.js` | Attendance CRUD operations |
| `courses/index.ts` | Course CRUD, fetch, update operations |
| `courses/presign.ts` | S3 presigned URL generation |
| `courses/mockdata.ts` | Mock course data |
| `dashboard/index.ts` | Dashboard data aggregation |
| `lms/exercises.ts` | LMS exercise operations |
| `marks/index.ts` | Grading and marks operations |
| `middlewares/authentication.server.ts` | Auth guard middleware |
| `middlewares/index.ts` | Middleware exports |
| `newsfeed/index.ts` | Newsfeed CRUD operations |
| `notification/notification.ts` | Notification handling |
| `org/domain.ts` | Custom domain management |
| `org/index.ts` | Organization CRUD operations |
| `org/quiz.js` | Quiz management |
| `posthog/index.ts` | PostHog analytics integration |
| `sentry/index.ts` | Sentry error tracking |
| `submissions/index.ts` | Exercise submission handling |

### Stores (`src/lib/utils/store/`) — No Tests

| Module | Key Exports |
|--------|------------|
| `app.ts` | App-wide state store |
| `org.ts` | Organization state store |
| `user.ts` | User state store |
| `attendance.ts` | Attendance state store |
| `useMobile.js` | Mobile detection store |

### Components (`src/lib/components/`) — No Tests

242 Svelte component files with zero unit test coverage. No component-level tests exist.

### Server API Routes (`src/routes/api/`) — No Tests

33 server route files with zero test coverage.

---

## API (`apps/api`)

**No test files exist.** All 37 source modules have zero test coverage.

### Routes (`src/routes/`)

| Module | Functionality | Covered | Test Reference |
|--------|--------------|---------|----------------|
| `mail.ts` | Email sending endpoints | No | — |
| `course/clone.ts` | Course cloning endpoint | No | — |
| `course/course.ts` | Course CRUD endpoint | No | — |
| `course/katex.ts` | KaTeX rendering endpoint | No | — |
| `course/lesson.ts` | Lesson operations endpoint | No | — |
| `course/presign.ts` | S3 presigned URL endpoint | No | — |

### Services (`src/services/`)

| Module | Functionality | Covered | Test Reference |
|--------|--------------|---------|----------------|
| `mail.ts` | Email service logic | No | — |
| `course/clone.ts` | Course clone logic | No | — |

### Middleware (`src/middlewares/`)

| Module | Functionality | Covered | Test Reference |
|--------|--------------|---------|----------------|
| `auth.ts` | Authentication middleware | No | — |
| `rate-limiter.ts` | Rate limiting middleware | No | — |

### Utilities (`src/utils/`)

| Module | Functionality | Covered | Test Reference |
|--------|--------------|---------|----------------|
| `certificate.ts` | Certificate generation | No | — |
| `cloudflare.ts` | Cloudflare R2 integration | No | — |
| `course.ts` | Course helper functions | No | — |
| `email.ts` | Email utilities | No | — |
| `genUniqueId.ts` | Unique ID generation | No | — |
| `lesson.ts` | Lesson helper functions | No | — |
| `mail.ts` | Mail template utilities | No | — |
| `s3.ts` | S3 client setup | No | — |
| `supabase.ts` | Supabase client setup | No | — |
| `upload.ts` | Upload handling | No | — |
| `auth/validate-user.ts` | User validation | No | — |
| `openapi/index.ts` | OpenAPI spec generation | No | — |
| `redis/key-generators.ts` | Redis key generation | No | — |
| `redis/limiter.ts` | Rate limit logic | No | — |
| `redis/redis.ts` | Redis client setup | No | — |

### Config & Types

| Module | Functionality | Covered | Test Reference |
|--------|--------------|---------|----------------|
| `config/env.ts` | Zod env validation | No | — |
| `constants/index.ts` | API constants | No | — |
| `constants/rate-limiter.ts` | Rate limiter config | No | — |
| `constants/upload.ts` | Upload constants | No | — |
| `types/index.ts` | Type definitions | No | — |
| `types/database.ts` | Database types | No | — |
| `types/mail.ts` | Mail types | No | — |
| `types/course/index.ts` | Course types | No | — |
| `types/course/lesson.ts` | Lesson types | No | — |

---

## Course App (`apps/course-app`)

72 source files with only a demo placeholder test.

| Module | Functionality | Covered | Test Reference |
|--------|--------------|---------|----------------|
| `demo.spec.ts` | Placeholder arithmetic test | Yes | `demo.spec.ts` — "1 + 2 = 3" |
| All other modules | UI components, animation, routing | No | — |

---

## E2E Tests (Cypress)

> Not executed — requires running app on `http://localhost:4173`.

### Defined Scenarios

| Scenario | Test File | Description |
|----------|-----------|-------------|
| Auth — nav buttons visible | `cypress/e2e/dashboard/authentication.cy.js` | Verifies signup and login buttons in navigation |
| Auth — login redirect | `cypress/e2e/dashboard/authentication.cy.js` | Validates redirect to login page with form |
| Auth — signup redirect | `cypress/e2e/dashboard/authentication.cy.js` | Validates redirect to signup page with form |

---

## Modules Without Any Test Coverage

### Dashboard — Utility Functions (19 modules)

- `apps/dashboard/src/lib/utils/functions/api.js`
- `apps/dashboard/src/lib/utils/functions/app.js`
- `apps/dashboard/src/lib/utils/functions/appSetup.ts`
- `apps/dashboard/src/lib/utils/functions/domain.ts`
- `apps/dashboard/src/lib/utils/functions/fileValidation.ts`
- `apps/dashboard/src/lib/utils/functions/formatDate.js`
- `apps/dashboard/src/lib/utils/functions/logout.ts`
- `apps/dashboard/src/lib/utils/functions/number.ts`
- `apps/dashboard/src/lib/utils/functions/permissions.ts`
- `apps/dashboard/src/lib/utils/functions/sanitize.ts`
- `apps/dashboard/src/lib/utils/functions/supabase.server.ts`
- `apps/dashboard/src/lib/utils/functions/supabase.ts`
- `apps/dashboard/src/lib/utils/functions/theme.ts`
- `apps/dashboard/src/lib/utils/functions/toHtml.ts`
- `apps/dashboard/src/lib/utils/functions/translations.ts`
- `apps/dashboard/src/lib/utils/functions/trycatch.ts`
- `apps/dashboard/src/lib/utils/functions/user.ts`
- `apps/dashboard/src/lib/utils/functions/validator.ts`

### Dashboard — Services (21 modules, all uncovered)

- `apps/dashboard/src/lib/utils/services/api/constants.ts`
- `apps/dashboard/src/lib/utils/services/api/index.ts`
- `apps/dashboard/src/lib/utils/services/api/types.ts`
- `apps/dashboard/src/lib/utils/services/api/utils.ts`
- `apps/dashboard/src/lib/utils/services/attendance/index.js`
- `apps/dashboard/src/lib/utils/services/courses/index.ts`
- `apps/dashboard/src/lib/utils/services/courses/mockdata.ts`
- `apps/dashboard/src/lib/utils/services/courses/presign.ts`
- `apps/dashboard/src/lib/utils/services/dashboard/index.ts`
- `apps/dashboard/src/lib/utils/services/lms/exercises.ts`
- `apps/dashboard/src/lib/utils/services/marks/index.ts`
- `apps/dashboard/src/lib/utils/services/middlewares/authentication.server.ts`
- `apps/dashboard/src/lib/utils/services/middlewares/index.ts`
- `apps/dashboard/src/lib/utils/services/newsfeed/index.ts`
- `apps/dashboard/src/lib/utils/services/notification/notification.ts`
- `apps/dashboard/src/lib/utils/services/org/domain.ts`
- `apps/dashboard/src/lib/utils/services/org/index.ts`
- `apps/dashboard/src/lib/utils/services/org/quiz.js`
- `apps/dashboard/src/lib/utils/services/posthog/index.ts`
- `apps/dashboard/src/lib/utils/services/sentry/index.ts`
- `apps/dashboard/src/lib/utils/services/submissions/index.ts`

### Dashboard — Stores (5 modules, all uncovered)

- `apps/dashboard/src/lib/utils/store/app.ts`
- `apps/dashboard/src/lib/utils/store/attendance.ts`
- `apps/dashboard/src/lib/utils/store/org.ts`
- `apps/dashboard/src/lib/utils/store/useMobile.js`
- `apps/dashboard/src/lib/utils/store/user.ts`

### Dashboard — Components (242 Svelte files, all uncovered)

### Dashboard — Server API Routes (33 files, all uncovered)

### API — All Modules (37 files, all uncovered)

- `apps/api/src/index.ts`
- `apps/api/src/app.ts`
- `apps/api/src/rpc-types.ts`
- `apps/api/src/config/env.ts`
- `apps/api/src/constants/index.ts`
- `apps/api/src/constants/rate-limiter.ts`
- `apps/api/src/constants/upload.ts`
- `apps/api/src/middlewares/auth.ts`
- `apps/api/src/middlewares/rate-limiter.ts`
- `apps/api/src/routes/mail.ts`
- `apps/api/src/routes/course/clone.ts`
- `apps/api/src/routes/course/course.ts`
- `apps/api/src/routes/course/katex.ts`
- `apps/api/src/routes/course/lesson.ts`
- `apps/api/src/routes/course/presign.ts`
- `apps/api/src/services/mail.ts`
- `apps/api/src/services/course/clone.ts`
- `apps/api/src/types/index.ts`
- `apps/api/src/types/database.ts`
- `apps/api/src/types/mail.ts`
- `apps/api/src/types/course/index.ts`
- `apps/api/src/types/course/lesson.ts`
- `apps/api/src/utils/auth/validate-user.ts`
- `apps/api/src/utils/certificate.ts`
- `apps/api/src/utils/cloudflare.ts`
- `apps/api/src/utils/course.ts`
- `apps/api/src/utils/email.ts`
- `apps/api/src/utils/genUniqueId.ts`
- `apps/api/src/utils/lesson.ts`
- `apps/api/src/utils/mail.ts`
- `apps/api/src/utils/s3.ts`
- `apps/api/src/utils/supabase.ts`
- `apps/api/src/utils/upload.ts`
- `apps/api/src/utils/openapi/index.ts`
- `apps/api/src/utils/redis/key-generators.ts`
- `apps/api/src/utils/redis/limiter.ts`
- `apps/api/src/utils/redis/redis.ts`

### Course App — All Modules (72 files, all uncovered)
