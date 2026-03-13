# Functional Test Coverage Report

> Generated: 2026-03-13
> Scope: apps/dashboard, apps/api, apps/course-app, packages/course-app, cypress e2e

## Summary

| Metric | Count |
|---|---|
| Functional areas identified | 25 |
| Well tested | 0 |
| Partially tested | 3 |
| Smoke only | 2 |
| Untested | 20 |

**Overall assessment:** Test coverage is critically low. The test suite consists of 14 utility function unit tests (Jest), 1 Cypress E2E smoke test, and 4 course-app template tests (Vitest/Playwright). No services, API endpoints, routes, or components have meaningful test coverage.

## Test Suite Inventory

| App | Framework | Test Files | Type |
|---|---|---|---|
| dashboard | Jest | 14 spec files | Unit |
| dashboard | Cypress | 1 cy.js file | E2E |
| api | Vitest (configured) | **0 test files** | — |
| course-app template | Vitest | 3 test files | Unit + Integration |
| course-app template | Playwright | 1 spec file | E2E |
| course-app | — | 1 demo spec (placeholder: 1+2=3) | — |

**Total: 20 test files** (19 real + 1 placeholder)
- By type: 17 unit, 1 integration (page.server.test), 2 e2e (Cypress auth + Playwright course)

## Coverage by Domain

### Authentication & Account Management

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Login page navigation | Smoke only | Critical | `cypress/e2e/dashboard/authentication.cy.js` | Only checks button exists and redirects to /login; no actual login tested |
| Signup page navigation | Smoke only | Critical | `cypress/e2e/dashboard/authentication.cy.js` | Only checks button exists and redirects to /signup; no actual signup tested |
| Actual login flow (credentials) | Untested | Critical | — | No test submits credentials or verifies session creation |
| Actual signup flow | Untested | Critical | — | No test creates an account |
| Password reset (forgot/reset) | Untested | High | — | Two routes exist, zero tests |
| Logout | Untested | Medium | — | |
| Email verification | Untested | High | — | Token generation/validation untested |
| OAuth/GitHub auth | Untested | High | — | Configured in Supabase, no tests |
| Accept teacher invitation | Untested | High | — | `/invite/t/[hash]` route untested |
| Accept student invitation | Untested | High | — | `/invite/s/[hash]` route untested |

### Course Management

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Course creation | Untested | Critical | — | Core feature, no tests |
| Course editing/metadata | Untested | High | — | Title, description, logo, pricing |
| Course publishing/unpublishing | Untested | High | — | Visibility toggle untested |
| Course cloning (API) | Untested | Critical | — | Complex multi-table operation in `services/course/clone.ts` — zero tests |
| Course listing | Untested | High | — | |
| Course landing page editor | Untested | Medium | — | |
| Course deletion | Untested | High | — | Data loss risk |
| Is course free check | Partially tested | Low | `course.spec.ts` | `isCourseFree` utility tested; actual pricing flow untested |
| Course slug generation | Partially tested | Low | `generateSlug.spec.js` | Utility tested; not integration-tested |

### Lesson Management

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Lesson CRUD | Untested | Critical | — | Core content management |
| Lesson sections (create/reorder) | Untested | High | — | V1 vs V2 structure |
| Lesson content editing | Untested | High | — | Rich text/markdown editing |
| Lesson completion tracking | Untested | High | — | |
| Lesson comments | Untested | Medium | — | |
| Lesson language/translations | Untested | Medium | — | |
| Lesson PDF download | Untested | Low | — | Currently disabled in API code |

### Exercise & Assessment

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Create exercises with questions | Untested | Critical | — | |
| Submit exercise answers | Untested | Critical | — | Core student interaction |
| Grade submissions | Untested | Critical | — | Multi-table write with scoring |
| View submission details | Untested | High | — | |
| Submission early/late check | Partially tested | Low | `IsSubmissionEarly.spec.js` | Date comparison logic tested; full flow untested |

### Organization Management

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Org dashboard/analytics | Untested | High | — | Revenue, courses, students metrics |
| Org creation/setup | Untested | High | — | |
| Org settings | Untested | Medium | — | General, teams, domains, customization |
| Team management | Untested | High | — | Adding/removing members, role assignment |
| Audience management | Untested | Medium | — | |
| Site name generation | Partially tested | Low | `org.spec.ts` | `generateSitename` tested; actual org CRUD untested |
| Quiz pin generation | Partially tested | Low | `org.spec.ts` | `genQuizPin` tested; quiz feature untested |
| Custom domains | Untested | Medium | — | Vercel domain API integration |

### Student LMS

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Student dashboard | Untested | High | — | /lms route |
| Course enrollment | Untested | Critical | — | Student joining a course |
| Course progress tracking | Untested | High | — | |
| My Learning view | Untested | Medium | — | |
| Explore/discover courses | Untested | Medium | — | |
| Student exercises view | Untested | High | — | |
| Certificate viewing/download | Untested | Medium | — | |

### Billing & Subscriptions (Polar)

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Subscribe to plan | Untested | Critical | — | Money-touching |
| Webhook handling | Untested | Critical | — | Payment state sync |
| Customer portal | Untested | High | — | |
| Plan management | Untested | High | — | |

### Community & Communication

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Course newsfeed (CRUD) | Untested | High | — | Post/edit/delete announcements |
| Newsfeed comments | Untested | Medium | — | |
| Pin announcements | Untested | Low | — | |
| Community Q&A forum | Untested | Medium | — | Question/answer routes |

### API: PDF Generation & File Management

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Certificate PDF generation | Untested | High | — | POST /course/download/certificate |
| Course PDF download | Untested | Medium | — | POST /course/download/content |
| LaTeX/KaTeX rendering | Untested | Medium | — | GET /course/katex |
| S3 presigned URL (video upload) | Untested | High | — | Auth-protected upload |
| S3 presigned URL (doc upload) | Untested | High | — | Auth-protected upload |
| S3 presigned URL (downloads) | Untested | Medium | — | Download URL generation |

### API: Email/Notifications

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Email sending (Zoho/Nodemailer) | Untested | Critical | — | POST /mail/send; dual provider logic |
| Welcome/invite emails | Untested | High | — | 11 notification types |
| Email domain validation | Untested | High | — | Must send from @mail.classroomio.com |
| Email verification tokens | Untested | High | — | Token generation and expiry |

### API: Security & Infrastructure

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Auth middleware (Supabase JWT) | Untested | Critical | — | Guards presign + clone routes |
| Rate limiting (Redis) | Untested | High | — | Applied globally |
| CORS configuration | Untested | Medium | — | |
| Zod input validation | Untested | High | — | All endpoints have schemas |

### AI Features

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| AI lesson generation | Untested | Medium | — | /api/completion with OpenAI |
| AI exercise generation | Untested | Medium | — | /api/completion/exerciseprompt |
| AI grading | Untested | Medium | — | /api/completion/gradingprompt |

### Analytics & Reporting

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Course analytics | Untested | Medium | — | Student progress, completion |
| Dashboard analytics | Untested | Low | — | Aggregated metrics |

### Course App Template (Public Course Rendering)

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Course data loading | Partially tested | Medium | `page.server.test.ts` | Tests fetch success + error; mocked fetch |
| Course page rendering | Smoke only | Low | `page.test.ts` | Checks CSS class + prop passing only |
| Dark mode toggle | Well tested | Low | `toggleMode.test.ts` | 4 assertions: add/remove class, preserve existing |
| Lesson sidebar navigation | Partially tested | Medium | `course.spec.ts` (Playwright) | E2E: nav, dark mode, mobile, unpublished |
| Mobile responsiveness | Partially tested | Low | `course.spec.ts` (Playwright) | Viewport resize tested |

### Utility Functions (Dashboard)

| Feature | Coverage | Risk | Test files | Notes |
|---|---|---|---|---|
| Email validation | Well tested | Low | `validateEmail.spec.js` | Valid, invalid, empty, uppercase, special chars |
| UUID generation/validation | Well tested | Low | `generateUUID.spec.ts` | Generation, uniqueness, format validation |
| Date formatting | Well tested | Low | `date.spec.ts` | `calDateDiff` + `getGreeting` with fake timers |
| YouTube URL formatting | Well tested | Low | `formatYoutubeVideo.spec.ts` | Embed URL conversion + ID extraction |
| Currency formatting | Well tested | Low | `getCurrencyFormatter.spec.ts` | NGN, USD, EUR |
| String capitalization | Well tested | Low | `string.spec.ts` | 5 cases |
| Unique ID generation | Well tested | Low | `genUniqueId.spec.js` | Format, uniqueness, prefix |
| isObject check | Well tested | Low | `isObject.spec.ts` | 4 cases |
| removeDuplicate | Well tested | Low | `removeDuplicate.spec.js` | 5 cases |
| showAppsSideBar | Well tested | Low | `showAppsSideBar.spec.js` | Path matching logic |
| Slug generation | Partially tested | Low | `generateSlug.spec.js` | Basic conversion + timestamp |
| Quiz PIN generation | Well tested | Low | `org.spec.ts` | 6-digit range, uniqueness |
| Site name generation | Well tested | Low | `org.spec.ts` | Special chars, spaces, empty |
| Is course free | Partially tested | Low | `course.spec.ts` | 0, negative, NaN |

## Top Gaps (Prioritized)

1. **Authentication flows** — Critical risk, smoke only. Login, signup, password reset, and session management have no functional tests. A broken auth flow blocks all users.

2. **Exercise submission & grading** — Critical risk, untested. Core LMS workflow: students submit, teachers grade. Multi-table writes with scoring logic.

3. **Course cloning (API)** — Critical risk, untested. Complex multi-table operation copying courses, groups, sections, lessons, translations, exercises, questions, and options. Highest regression risk in the codebase.

4. **Payment/subscription handling (Polar)** — Critical risk, untested. Webhook processing and plan management directly affect billing. Financial operations with zero coverage.

5. **Email sending (API)** — Critical risk, untested. Dual-provider logic (Zoho + Nodemailer), domain validation, template rendering. Failures are silent to users.

6. **Auth middleware (API)** — Critical risk, untested. JWT validation via Supabase protects presigned URLs and clone operations. A bypass = unauthorized access.

7. **Course CRUD** — Critical risk, untested. Create, edit, delete, and publish courses — the primary teacher workflow.

8. **Student enrollment** — Critical risk, untested. Joining a course, viewing content, tracking progress — the core student journey.

9. **Lesson management** — Critical risk, untested. CRUD, completion tracking, sections, content editing — foundational to course delivery.

10. **S3 presigned URLs** — High risk, untested. Auth-protected file upload/download. Incorrect handling could expose files or break uploads.

## Test Suite Health

- **Total test files**: 20 (14 dashboard unit, 1 Cypress E2E, 4 course-app template, 1 placeholder)
- **By type**: 17 unit, 1 integration, 2 E2E
- **API test files**: 0 (vitest config exists, no tests written)

### Observations

- **All dashboard tests are pure utility function unit tests.** No service, component, page, or route tests exist for the dashboard.
- **The API has zero tests** despite having a vitest config. The most complex business logic (course cloning, email sending, S3 presigning, auth middleware) is completely untested.
- **The Cypress E2E is superficial.** It only verifies navigation to login/signup pages — never actually authenticates.
- **The Playwright tests (course-app template) are the most thorough** — they test real user interactions: sidebar navigation, dark mode, mobile viewport, unpublished content handling.
- **Zero integration tests for Supabase queries.** No test verifies that database operations work correctly.
- **No skipped/disabled tests found** — no `xit`, `test.skip`, `.only` patterns. Existing tests all pass.
- **Test pyramid is inverted.** Only the base exists (utility unit tests). The middle (service/integration) and top (E2E) layers are nearly empty.
- **Jest is used for dashboard** (SvelteKit projects typically use Vitest) — may indicate the test setup predates the current framework.

## Recommended Next Steps

1. **Add API integration tests for course cloning** — The `cloneCourse` service is the most complex logic with multi-table operations. Test with local Supabase to verify all entities are correctly copied. Start here for maximum risk reduction.

2. **Expand Cypress E2E to cover full auth flow** — Extend `authentication.cy.js` to log in with `admin@test.com`/`123456`, verify the dashboard loads, navigate protected routes, and log out.

3. **Add API unit tests for email sending** — Test Zoho/Nodemailer dual-path logic, `@mail.classroomio.com` domain validation, and `test.com` recipient blocking in `routes/mail.ts`.

4. **Add API unit tests for auth middleware** — Test valid tokens pass, invalid/expired tokens reject, user context is set. Mock the Supabase client.

5. **Add API unit tests for S3 presigning** — Test URL generation for upload/download across video and document buckets. Mock the S3 client.

6. **Add Cypress E2E for course creation → lesson → exercise flow** — Test the full teacher workflow: create course, add lesson, add exercise, verify student can view.

7. **Add Polar webhook handler tests** — Mock webhook payloads for subscription created/cancelled/updated events and verify plan state changes.

8. **Add exercise submission E2E test** — Test the core assessment loop: student submits answers → teacher reviews → grades → student sees feedback.
