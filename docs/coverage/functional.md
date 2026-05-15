# Functional Test Coverage

_Generated 2026-05-15. Covers user-facing behaviour — pages, server routes, API endpoints — not line coverage._

## Summary

| Layer | Covered |
|-------|---------|
| Dashboard pages | 3 / 49 (6%) |
| Dashboard server routes (`+server.ts`) | 0 / 34 (0%) |
| Hono API endpoints | 0 / 12 (0%) |

**Legend:** ✅ unit + e2e &nbsp;&nbsp; 🧪 unit only &nbsp;&nbsp; 🌐 e2e only &nbsp;&nbsp; ❌ none

## Dashboard Pages

| Route | Tests |
|-------|-------|
| `/` | 🌐 e2e only |
| `/404` | ❌ none |
| `/course/[slug]` | ❌ none |
| `/courses/[id]` | ❌ none |
| `/courses/[id]/analytics` | ❌ none |
| `/courses/[id]/attendance` | ❌ none |
| `/courses/[id]/certificates` | ❌ none |
| `/courses/[id]/landingpage` | ❌ none |
| `/courses/[id]/lessons` | ❌ none |
| `/courses/[id]/lessons/[...lessonParams]` | ❌ none |
| `/courses/[id]/marks` | ❌ none |
| `/courses/[id]/people` | ❌ none |
| `/courses/[id]/people/[personId]` | ❌ none |
| `/courses/[id]/settings` | ❌ none |
| `/courses/[id]/submissions` | ❌ none |
| `/forgot` | ❌ none |
| `/home` | ❌ none |
| `/invite/s/[hash]` | ❌ none |
| `/invite/t/[hash]` | ❌ none |
| `/lms` | ❌ none |
| `/lms/community` | ❌ none |
| `/lms/community/[slug]` | ❌ none |
| `/lms/community/ask` | ❌ none |
| `/lms/exercises` | ❌ none |
| `/lms/explore` | ❌ none |
| `/lms/mylearning` | ❌ none |
| `/lms/settings` | ❌ none |
| `/login` | 🌐 e2e only |
| `/logout` | ❌ none |
| `/onboarding` | ❌ none |
| `/org/[slug]` | ❌ none |
| `/org/[slug]/audience` | ❌ none |
| `/org/[slug]/audience/[...params]` | ❌ none |
| `/org/[slug]/community` | ❌ none |
| `/org/[slug]/community/[slug]` | ❌ none |
| `/org/[slug]/community/ask` | ❌ none |
| `/org/[slug]/courses` | ❌ none |
| `/org/[slug]/quiz` | ❌ none |
| `/org/[slug]/quiz/[slug]` | ❌ none |
| `/org/[slug]/settings` | ❌ none |
| `/org/[slug]/settings/customize-lms` | ❌ none |
| `/org/[slug]/settings/domains` | ❌ none |
| `/org/[slug]/settings/teams` | ❌ none |
| `/org/[slug]/setup` | ❌ none |
| `/profile/[id]` | ❌ none |
| `/reset` | ❌ none |
| `/signup` | 🌐 e2e only |
| `/upgrade` | ❌ none |
| `/verify-email-error` | ❌ none |

## Dashboard Server Routes

| Route | Tests |
|-------|-------|
| `/api/admin/cleanup-tokens` | ❌ none |
| `/api/admin/security-monitor` | ❌ none |
| `/api/analytics/dash` | ❌ none |
| `/api/analytics/user` | ❌ none |
| `/api/completion` | ❌ none |
| `/api/completion/customprompt` | ❌ none |
| `/api/completion/exerciseprompt` | ❌ none |
| `/api/completion/gradingprompt` | ❌ none |
| `/api/courses/analytics` | ❌ none |
| `/api/courses/data` | ❌ none |
| `/api/courses/exercises` | ❌ none |
| `/api/courses/marks` | ❌ none |
| `/api/courses/newsfeed` | ❌ none |
| `/api/courses/submission` | ❌ none |
| `/api/courses/submissions` | ❌ none |
| `/api/domain` | ❌ none |
| `/api/email/course/exercise_submission_update` | ❌ none |
| `/api/email/course/newsfeed` | ❌ none |
| `/api/email/course/student_prove_payment` | ❌ none |
| `/api/email/course/student_welcome` | ❌ none |
| `/api/email/course/submission_update` | ❌ none |
| `/api/email/course/teacher_student_buycourse` | ❌ none |
| `/api/email/course/teacher_student_joined` | ❌ none |
| `/api/email/course/teacher_welcome` | ❌ none |
| `/api/email/invite` | ❌ none |
| `/api/email/verify_email` | ❌ none |
| `/api/email/welcome` | ❌ none |
| `/api/org/audience` | ❌ none |
| `/api/org/team` | ❌ none |
| `/api/polar/portal` | ❌ none |
| `/api/polar/subscribe` | ❌ none |
| `/api/polar/webhook` | ❌ none |
| `/api/unsplash` | ❌ none |
| `/csp-report` | ❌ none |

## Hono API Endpoints

| Method | Path | File | Tests |
|--------|------|------|-------|
| `GET` | `/` | `app.ts` | ❌ none |
| `POST` | `/clone/` | `routes/course/clone.ts` | ❌ none |
| `POST` | `/course/download/certificate` | `routes/course/course.ts` | ❌ none |
| `POST` | `/course/download/content` | `routes/course/course.ts` | ❌ none |
| `GET` | `/docs` | `utils/openapi/index.ts` | ❌ none |
| `GET` | `/katex/` | `routes/course/katex.ts` | ❌ none |
| `POST` | `/lesson/download/pdf` | `routes/course/lesson.ts` | ❌ none |
| `POST` | `/mail/send` | `routes/mail.ts` | ❌ none |
| `POST` | `/presign/document/download` | `routes/course/presign.ts` | ❌ none |
| `POST` | `/presign/document/upload` | `routes/course/presign.ts` | ❌ none |
| `POST` | `/presign/video/download` | `routes/course/presign.ts` | ❌ none |
| `POST` | `/presign/video/upload` | `routes/course/presign.ts` | ❌ none |
