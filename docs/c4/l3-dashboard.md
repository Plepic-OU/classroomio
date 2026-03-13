# L3 Dashboard Components
_Generated: 2026-03-13T08:23:26Z | componentDepth: 5 | Source files: 377 ts_
_AST-derived via ts-morph. Svelte `<script>` imports are not analysed (see c4-conventions.md)._

```mermaid
graph TD

  ext-Supabase["Supabase\n(external)"]
  ext-OpenAI["OpenAI\n(external)"]
  ext-Polar["Polar\n(external)"]

  subgraph Routes
    dashboard-routes["routes\n(2ts, 3svelte)"]
    dashboard-routes-course--slug-["course/[slug]\n(1ts, 1svelte)"]
    dashboard-routes-courses--id-["courses/[id]\n(1ts, 2svelte)"]
    dashboard-routes-courses--id--analytics["courses/[id]/analytics\n(1ts, 1svelte)"]
    dashboard-routes-courses--id--people["courses/[id]/people\n(1ts, 2svelte)"]
    dashboard-routes-courses--id--people--personId-["courses/[id]/people/[personId]\n(1ts, 1svelte)"]
    dashboard-routes-csp-report["csp-report\n(1ts)"]
    dashboard-routes-invite-s--hash-["invite/s/[hash]\n(1ts, 1svelte)"]
    dashboard-routes-invite-t--hash-["invite/t/[hash]\n(1ts, 1svelte)"]
    dashboard-routes-org--slug-["org/[slug]\n(1ts, 2svelte)"]
    dashboard-routes-org--slug--audience-----params-["org/[slug]/audience\n(1ts, 1svelte)"]
    dashboard-routes-org--slug--setup["org/[slug]/setup\n(1ts, 1svelte)"]
    dashboard-routes-api-admin-cleanup-tokens["api/admin/cleanup-tokens\n(1ts)"]
    dashboard-routes-api-admin-security-monitor["api/admin/security-monitor\n(1ts)"]
    dashboard-routes-api-analytics-dash["api/analytics/dash\n(1ts)"]
    dashboard-routes-api-analytics-user["api/analytics/user\n(1ts)"]
    dashboard-routes-api-completion["api/completion\n(1ts)"]
    dashboard-routes-api-completion-customprompt["api/completion/customprompt\n(1ts)"]
    dashboard-routes-api-completion-exerciseprompt["api/completion/exerciseprompt\n(1ts)"]
    dashboard-routes-api-completion-gradingprompt["api/completion/gradingprompt\n(1ts)"]
    dashboard-routes-api-courses-analytics["api/courses/analytics\n(1ts)"]
    dashboard-routes-api-courses-data["api/courses/data\n(1ts)"]
    dashboard-routes-api-courses-exercises["api/courses/exercises\n(1ts)"]
    dashboard-routes-api-courses-marks["api/courses/marks\n(1ts)"]
    dashboard-routes-api-courses-newsfeed["api/courses/newsfeed\n(1ts)"]
    dashboard-routes-api-courses-submission["api/courses/submission\n(1ts)"]
    dashboard-routes-api-courses-submissions["api/courses/submissions\n(1ts)"]
    dashboard-routes-api-domain["api/domain\n(1ts)"]
    dashboard-routes-api-email-course-exercise-submission-update["email/exercise_sub_update\n(1ts)"]
    dashboard-routes-api-email-course-newsfeed["email/course/newsfeed\n(1ts)"]
    dashboard-routes-api-email-course-student-prove-payment["email/student_prove_payment\n(1ts)"]
    dashboard-routes-api-email-course-student-welcome["email/student_welcome\n(1ts)"]
    dashboard-routes-api-email-course-submission-update["email/submission_update\n(1ts)"]
    dashboard-routes-api-email-course-teacher-student-buycourse["email/teacher_student_buycourse\n(1ts)"]
    dashboard-routes-api-email-course-teacher-student-joined["email/teacher_student_joined\n(1ts)"]
    dashboard-routes-api-email-course-teacher-welcome["email/teacher_welcome\n(1ts)"]
    dashboard-routes-api-email-invite["email/invite\n(1ts)"]
    dashboard-routes-api-email-verify-email["email/verify_email\n(1ts)"]
    dashboard-routes-api-email-welcome["email/welcome\n(1ts)"]
    dashboard-routes-api-org-audience["api/org/audience\n(1ts)"]
    dashboard-routes-api-org-team["api/org/team\n(1ts)"]
    dashboard-routes-api-polar-portal["api/polar/portal\n(1ts)"]
    dashboard-routes-api-polar-subscribe["api/polar/subscribe\n(1ts)"]
    dashboard-routes-api-polar-webhook["api/polar/webhook\n(1ts)"]
    dashboard-routes-api-unsplash["api/unsplash\n(1ts)"]
  end

  subgraph Components
    dashboard-lib["lib\n(1ts)"]
    dashboard-lib-components-Analytics["Analytics\n(1ts, 3svelte)"]
    dashboard-lib-components-Apps["Apps\n(1ts, 1svelte)"]
    dashboard-lib-components-Apps-components-Poll["Apps/Poll\n(4ts, 6svelte)"]
    dashboard-lib-components-Course["Course\n(2ts)"]
    dashboard-lib-components-Course-components-Ceritficate["Course/Certificate\n(1ts, 12svelte)"]
    dashboard-lib-components-Course-components-Lesson["Course/Lesson\n(9ts, 34svelte)"]
    dashboard-lib-components-Course-components-Navigation["Course/Navigation\n(1ts, 3svelte)"]
    dashboard-lib-components-Course-components-NewsFeed["Course/NewsFeed\n(1ts, 4svelte)"]
    dashboard-lib-components-Course-components-People["Course/People\n(1ts, 3svelte)"]
    dashboard-lib-components-CourseLandingPage["CourseLandingPage\n(2ts, 1svelte)"]
    dashboard-lib-components-Courses["Courses\n(1ts, 1svelte)"]
    dashboard-lib-components-Navigation["Navigation\n(1ts, 7svelte)"]
    dashboard-lib-components-Org["Org\n(1ts, 3svelte)"]
    dashboard-lib-components-Org-Settings["Org/Settings\n(1ts, 11svelte)"]
    dashboard-lib-components-Page["Page\n(1ts, 5svelte)"]
    dashboard-lib-components-Question["Question\n(1ts, 3svelte)"]
    dashboard-lib-components-Snackbar["Snackbar\n(1ts, 1svelte)"]
    dashboard-lib-components-TextEditor-TinymceSvelte["TextEditor/Tinymce\n(1ts, 1svelte)"]
    dashboard-lib-components-UploadWidget["UploadWidget\n(1ts, 1svelte)"]
  end

  subgraph Utils
    dashboard-lib-utils-constants["utils/constants\n(5ts)"]
    dashboard-lib-utils-functions["utils/functions\n(32ts)"]
    dashboard-lib-utils-functions-routes["utils/functions/routes\n(3ts)"]
    dashboard-lib-utils-functions-tinymce["utils/functions/tinymce\n(1ts)"]
    dashboard-lib-utils-services-api["utils/services/api\n(4ts)"]
    dashboard-lib-utils-services-courses["utils/services/courses\n(3ts)"]
    dashboard-lib-utils-services-dashboard["utils/services/dashboard\n(1ts)"]
    dashboard-lib-utils-services-lms["utils/services/lms\n(1ts)"]
    dashboard-lib-utils-services-marks["utils/services/marks\n(1ts)"]
    dashboard-lib-utils-services-middlewares["utils/services/middlewares\n(2ts)"]
    dashboard-lib-utils-services-newsfeed["utils/services/newsfeed\n(1ts)"]
    dashboard-lib-utils-services-notification["utils/services/notification\n(1ts)"]
    dashboard-lib-utils-services-org["utils/services/org\n(2ts)"]
    dashboard-lib-utils-services-posthog["utils/services/posthog\n(1ts)"]
    dashboard-lib-utils-services-sentry["utils/services/sentry\n(1ts)"]
    dashboard-lib-utils-services-submissions["utils/services/submissions\n(1ts)"]
    dashboard-lib-utils-store["utils/store\n(4ts)"]
    dashboard-lib-utils-types["utils/types\n(9ts)"]
  end

  subgraph Mail
    dashboard-mail["mail\n(1ts — sendEmail)"]
  end

  %% Component internal relationships
  dashboard-lib -->|"uses"| dashboard-lib-utils-types
  dashboard-lib-components-Apps-components-Poll -->|"uses"| dashboard-lib-components-Snackbar
  dashboard-lib-components-Apps-components-Poll -->|"uses"| dashboard-lib-utils-functions
  dashboard-lib-components-Course -->|"uses"| dashboard-lib-components-Course-components-Lesson
  dashboard-lib-components-Course -->|"uses"| dashboard-lib-utils-constants
  dashboard-lib-components-Course-components-Lesson -->|"uses"| dashboard-lib-components-Question
  dashboard-lib-components-Course-components-Lesson -->|"uses"| dashboard-lib-utils-functions
  dashboard-lib-components-Course-components-Lesson -->|"uses"| dashboard-lib-components-Snackbar
  dashboard-lib-components-Course-components-NewsFeed -->|"uses"| dashboard-lib-utils-types
  dashboard-lib-components-UploadWidget -->|"uses"| dashboard-lib-utils-functions

  %% Utils internal relationships
  dashboard-lib-utils-functions -->|"uses (2 imports)"| dashboard-lib-utils-store
  dashboard-lib-utils-functions -->|"uses (2 imports)"| dashboard-lib-utils-constants
  dashboard-lib-utils-functions -->|"uses (2 imports)"| dashboard-lib-utils-functions-routes
  dashboard-lib-utils-functions -->|"uses (2 imports)"| dashboard-lib
  dashboard-lib-utils-functions -->|"uses"| dashboard-lib-components-Course-components-People
  dashboard-lib-utils-functions-routes -->|"uses"| dashboard-lib-utils-constants
  dashboard-lib-utils-services-api -->|"uses"| dashboard-lib-utils-functions
  dashboard-lib-utils-services-courses -->|"uses"| dashboard-lib-components-Question
  dashboard-lib-utils-services-courses -->|"uses"| dashboard-lib-utils-constants
  dashboard-lib-utils-services-courses -->|"uses"| dashboard-lib-utils-store
  dashboard-lib-utils-services-courses -->|"uses (2 imports)"| dashboard-lib-utils-functions
  dashboard-lib-utils-services-courses -->|"uses"| dashboard-lib-components-Course-components-Lesson
  dashboard-lib-utils-services-dashboard -->|"uses"| dashboard-lib-utils-functions
  dashboard-lib-utils-services-lms -->|"uses"| dashboard-lib-utils-functions
  dashboard-lib-utils-services-marks -->|"uses"| dashboard-lib-utils-functions
  dashboard-lib-utils-services-middlewares -->|"uses"| dashboard-lib-utils-functions
  dashboard-lib-utils-services-newsfeed -->|"uses"| dashboard-lib-utils-functions
  dashboard-lib-utils-services-newsfeed -->|"uses"| dashboard-lib-utils-types
  dashboard-lib-utils-services-notification -->|"uses"| dashboard-lib-utils-functions
  dashboard-lib-utils-services-org -->|"uses (2 imports)"| dashboard-lib-utils-types
  dashboard-lib-utils-services-org -->|"uses"| dashboard-lib-utils-constants
  dashboard-lib-utils-services-org -->|"uses"| dashboard-lib-utils-store
  dashboard-lib-utils-services-org -->|"uses"| dashboard-lib-utils-functions
  dashboard-lib-utils-services-submissions -->|"uses"| dashboard-lib-utils-functions
  dashboard-lib-utils-store -->|"uses"| dashboard-lib-utils-types
  dashboard-lib-utils-store -->|"uses (2 imports)"| dashboard-lib-utils-constants

  %% Route relationships
  dashboard-routes -->|"uses (2 imports)"| dashboard-lib-utils-functions
  dashboard-routes -->|"uses"| dashboard-lib-utils-types
  dashboard-routes -->|"uses"| dashboard-lib-utils-constants
  dashboard-routes -->|"uses"| dashboard-lib-utils-store
  dashboard-routes-course--slug- -->|"uses"| dashboard-lib-utils-functions
  dashboard-routes-invite-s--hash- -->|"uses"| dashboard-lib-utils-functions
  dashboard-routes-invite-t--hash- -->|"uses (2 imports)"| dashboard-lib-utils-functions
  dashboard-routes-org--slug--setup -->|"uses"| dashboard-lib-utils-functions
  dashboard-routes-api-admin-cleanup-tokens -->|"uses"| dashboard-lib-utils-functions
  dashboard-routes-api-admin-security-monitor -->|"uses"| dashboard-lib-utils-functions
  dashboard-routes-api-analytics-dash -->|"uses"| dashboard-lib-utils-functions
  dashboard-routes-api-analytics-dash -->|"uses"| dashboard-lib-utils-types
  dashboard-routes-api-analytics-user -->|"uses"| dashboard-lib-utils-types
  dashboard-routes-api-analytics-user -->|"uses (2 imports)"| dashboard-lib-utils-functions
  dashboard-routes-api-courses-analytics -->|"uses (2 imports)"| dashboard-lib-utils-types
  dashboard-routes-api-courses-analytics -->|"uses (3 imports)"| dashboard-lib-utils-functions
  dashboard-routes-api-courses-data -->|"uses (2 imports)"| dashboard-lib-utils-functions
  dashboard-routes-api-courses-data -->|"uses"| dashboard-lib-utils-constants
  dashboard-routes-api-courses-exercises -->|"uses (2 imports)"| dashboard-lib-utils-functions
  dashboard-routes-api-courses-marks -->|"uses (2 imports)"| dashboard-lib-utils-functions
  dashboard-routes-api-courses-newsfeed -->|"uses (2 imports)"| dashboard-lib-utils-functions
  dashboard-routes-api-courses-submission -->|"uses (2 imports)"| dashboard-lib-utils-functions
  dashboard-routes-api-courses-submissions -->|"uses (2 imports)"| dashboard-lib-utils-functions
  dashboard-routes-api-domain -->|"uses"| dashboard-lib-utils-services-org
  dashboard-routes-api-email-course-exercise-submission-update -->|"uses"| dashboard-mail
  dashboard-routes-api-email-course-newsfeed -->|"uses"| dashboard-lib-utils-services-newsfeed
  dashboard-routes-api-email-course-newsfeed -->|"uses"| dashboard-lib-utils-functions
  dashboard-routes-api-email-course-newsfeed -->|"uses"| dashboard-mail
  dashboard-routes-api-email-course-student-prove-payment -->|"uses"| dashboard-mail
  dashboard-routes-api-email-course-student-welcome -->|"uses"| dashboard-mail
  dashboard-routes-api-email-course-submission-update -->|"uses"| dashboard-mail
  dashboard-routes-api-email-course-teacher-student-buycourse -->|"uses"| dashboard-mail
  dashboard-routes-api-email-course-teacher-student-joined -->|"uses"| dashboard-mail
  dashboard-routes-api-email-course-teacher-welcome -->|"uses"| dashboard-mail
  dashboard-routes-api-email-invite -->|"uses"| dashboard-mail
  dashboard-routes-api-email-verify-email -->|"uses"| dashboard-mail
  dashboard-routes-api-email-verify-email -->|"uses"| dashboard-lib-utils-functions
  dashboard-routes-api-email-welcome -->|"uses"| dashboard-mail
  dashboard-routes-api-org-audience -->|"uses"| dashboard-lib-utils-functions
  dashboard-routes-api-org-team -->|"uses"| dashboard-lib-utils-functions
  dashboard-routes-api-org-team -->|"uses"| dashboard-lib-utils-constants
  dashboard-routes-api-polar-webhook -->|"uses"| dashboard-lib-utils-functions
  dashboard-routes-api-polar-webhook -->|"uses"| dashboard-lib-utils-types

  %% External relationships
  dashboard-lib-utils-functions -->|"uses (3 imports)"| ext-Supabase
  dashboard-lib-utils-store -->|"uses"| ext-Supabase
  dashboard-lib-utils-services-courses -->|"uses"| ext-Supabase
  dashboard-lib-utils-services-lms -->|"uses"| ext-Supabase
  dashboard-lib-utils-services-org -->|"uses"| ext-Supabase
  dashboard-lib-components-Course-components-Lesson -->|"uses"| ext-Supabase
  dashboard-routes-api-completion -->|"uses (2 imports)"| ext-OpenAI
  dashboard-routes-api-completion-customprompt -->|"uses (2 imports)"| ext-OpenAI
  dashboard-routes-api-completion-exerciseprompt -->|"uses (2 imports)"| ext-OpenAI
  dashboard-routes-api-completion-gradingprompt -->|"uses (2 imports)"| ext-OpenAI
  dashboard-routes-api-polar-portal -->|"uses"| ext-Polar
  dashboard-routes-api-polar-subscribe -->|"uses"| ext-Polar
  dashboard-routes-api-polar-webhook -->|"uses"| ext-Polar
```

## Notes
- `lib/mocks/` (css/git/html/js/node/php/python/react/typescript/vue) are code sample data fixtures for the in-app code editor. Excluded from diagram as data, not architecture.
- `__mocks__/$app` and `__root` are test/entry-point artifacts — excluded.
- Dashboard → API HTTP calls are invisible to static analysis. See L2 for cross-container relationships.
- `utils/functions` imports `Course/People` and `services/courses` imports `Course/Lesson` — these inverted dependencies (utils → component) are worth refactoring.
