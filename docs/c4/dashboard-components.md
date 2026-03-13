# C4 Layer 3 — Dashboard Components
_Auto-derived from AST extraction. Re-generate with `/c4-model`._

```mermaid
C4Component
  title Component Diagram — Dashboard (apps/dashboard)
  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")

  Container_Boundary(routes_boundary, "Routes (SvelteKit pages and API endpoints)") {
    Component(routes, "Routes", "SvelteKit", "Root layout — auth session, i18n, store initialisation")
    Component(routes_course_slug, "Course [Slug]", "SvelteKit", "Public course landing page by slug")
    Component(routes_courses_id, "Course Editor [Id]", "SvelteKit", "Course editor root layout and navigation")
    Component(routes_org_slug, "Org [Slug]", "SvelteKit", "Organisation root layout, admin guard")
    Component(routes_profile_id, "Profile [Id]", "SvelteKit", "User profile page")
    Component(routes_courses_id_analytics, "Course Analytics", "SvelteKit", "Per-course analytics dashboard")
    Component(routes_courses_id_attendance, "Attendance", "SvelteKit", "Lesson attendance tracker")
    Component(routes_courses_id_certificates, "Certificates", "SvelteKit", "Certificate management and download")
    Component(routes_courses_id_landingpage, "Landing Page", "SvelteKit", "Editable public-facing course landing page")
    Component(routes_courses_id_lessons, "Lessons", "SvelteKit", "Lesson list and editor")
    Component(routes_courses_id_marks, "Marks", "SvelteKit", "Student marks overview")
    Component(routes_courses_id_people, "People", "SvelteKit", "Enrollment and student management")
    Component(routes_courses_id_settings, "Course Settings", "SvelteKit", "Course configuration page")
    Component(routes_courses_id_submissions, "Submissions", "SvelteKit", "Exercise submissions review")
    Component(routes_invite_s_hash, "Student Invite [Hash]", "SvelteKit", "Student invite acceptance handler")
    Component(routes_invite_t_hash, "Teacher Invite [Hash]", "SvelteKit", "Teacher invite acceptance handler")
    Component(routes_lms_community_slug, "LMS Community [Slug]", "SvelteKit", "LMS student community thread")
    Component(routes_org_slug_community, "Org Community", "SvelteKit", "Organisation community forum section")
    Component(routes_org_slug_courses, "Org Courses", "SvelteKit", "Organisation course listing")
    Component(routes_org_slug_quiz, "Org Quiz", "SvelteKit", "Organisation quiz runner")
    Component(routes_org_slug_setup, "Org Setup", "SvelteKit", "Organisation onboarding wizard")
    Component(routes_api_email_course, "Email/Course API", "SvelteKit API Routes", "Course email endpoints: welcome, submission updates, newsfeed notifications")
  }

  Container_Boundary(ui_boundary, "UI Components (Svelte)") {
    Component(lib_components_Analytics, "Analytics", "Svelte/SvelteKit", "Course analytics charts and summary widgets")
    Component(lib_components_Apps, "Apps", "Svelte/SvelteKit", "In-course app integrations with store and constants")
    Component(lib_components_Apps_components, "Apps/Components", "Svelte/SvelteKit", "Poll and interactive app widgets")
    Component(lib_components_Chip, "Chip", "Svelte/SvelteKit", "Tag / chip UI element")
    Component(lib_components_Confetti, "Confetti", "Svelte/SvelteKit", "Celebration animation triggered via store")
    Component(lib_components_Course, "Course", "Svelte/SvelteKit", "Course editor: store, constants, helper functions")
    Component(lib_components_Course_components, "Course/Components", "Svelte/SvelteKit", "Lesson editor, exercise grading, submissions, certificates, newsfeed (88 files)")
    Component(lib_components_CourseLandingPage, "CourseLandingPage", "Svelte/SvelteKit", "Public course landing page layout and store")
    Component(lib_components_CourseLandingPage_components, "CourseLandingPage/Components", "Svelte/SvelteKit", "Landing page section sub-components")
    Component(lib_components_Courses, "Courses", "Svelte/SvelteKit", "Course list management and store")
    Component(lib_components_Courses_components, "Courses/Components", "Svelte/SvelteKit", "Course card, grid, and creation sub-components")
    Component(lib_components_Form, "Form", "Svelte/SvelteKit", "Reusable form field and validation components")
    Component(lib_components_Navigation, "Navigation", "Svelte/SvelteKit", "Sidebar and top navigation with type definitions")
    Component(lib_components_Org, "Org", "Svelte/SvelteKit", "Organisation switcher and org Svelte store")
    Component(lib_components_Org_Settings, "Org/Settings", "Svelte/SvelteKit", "Organisation settings panels (billing, team, domain)")
    Component(lib_components_Page, "Page", "Svelte/SvelteKit", "Page layout wrapper and empty-state components")
    Component(lib_components_PrimaryButton, "PrimaryButton", "Svelte/SvelteKit", "Branded primary action button")
    Component(lib_components_Question, "Question", "Svelte/SvelteKit", "Exercise question renderer and answer input")
    Component(lib_components_Snackbar, "Snackbar", "Svelte/SvelteKit", "Toast notification display and store")
    Component(lib_components_TextEditor_TinymceSvelte, "TinymceSvelte", "Svelte/SvelteKit", "TinyMCE rich-text editor Svelte wrapper")
    Component(lib_components_UploadWidget, "UploadWidget", "Svelte/SvelteKit", "File upload input widget")
    Component(lib_components_WelcomeModal, "WelcomeModal", "Svelte/SvelteKit", "First-login welcome modal with store")
  }

  Container_Boundary(utils_boundary, "Utilities and Services") {
    Component(lib_utils_constants, "Constants", "TypeScript", "App-wide constants: roles, route names, quiz config, course modes")
    Component(lib_utils_functions, "Functions", "TypeScript", "Shared utilities incl. Supabase client, auth helpers, formatters (47 files)")
    Component(lib_utils_functions_routes, "Functions/Routes", "TypeScript", "Route guards: isPublicRoute, shouldRedirectOnAuth, hideNav")
    Component(lib_utils_store, "Store", "TypeScript", "Svelte stores: currentOrg, user, app state, attendance")
    Component(lib_utils_types, "Types", "TypeScript", "Shared TypeScript interfaces: Org, Course, User, Submission, etc.")
    Component(lib_utils_services_api, "Services/Api", "TypeScript", "Hono RPC client (classroomio) and generic fetch wrapper (apiClient)")
    Component(lib_utils_services_courses, "Services/Courses", "TypeScript", "Course data queries, S3 pre-sign, and lesson helpers")
    Component(lib_utils_services_middlewares, "Services/Middlewares", "TypeScript", "Server-side JWT auth middleware for SvelteKit API routes")
    Component(lib_utils_services_org, "Services/Org", "TypeScript", "Organisation CRUD, custom domain management, quiz helpers")
  }

  System_Ext(supabase, "Supabase", "Postgres database, Auth, Realtime")
  System_Ext(openai, "OpenAI", "AI content and grading completions")
  System_Ext(polar, "Polar.sh", "Subscription billing and webhooks")

  Rel(routes, lib_utils_services_org, "Uses")
  Rel(routes, lib_utils_store, "Reads state from")
  Rel(routes, openai, "AI completions via /api/completion routes")
  Rel(routes, polar, "Billing via /api/polar routes")

  Rel(routes_course_slug, lib_utils_services_courses, "Queries course by slug")
  Rel(routes_invite_s_hash, lib_utils_services_org, "Validates student invite")
  Rel(routes_invite_t_hash, lib_utils_services_org, "Validates teacher invite")

  Rel(lib_components_Course, lib_components_Course_components, "Renders")
  Rel(lib_components_Apps_components, lib_components_Snackbar, "Shows notifications via")

  Rel(lib_components_Course_components, lib_components_Question, "Renders questions via")
  Rel(lib_components_Course_components, lib_components_Confetti, "Triggers on completion")
  Rel(lib_components_Course_components, lib_utils_services_courses, "Queries course data via")
  Rel(lib_components_Course_components, lib_components_Snackbar, "Shows notifications via")

  Rel(lib_utils_services_courses, lib_components_Question, "Imports question types from")
  Rel(lib_utils_services_courses, lib_utils_store, "Reads org/user state from")
  Rel(lib_utils_services_courses, lib_components_Course_components, "Uses lesson store from")
  Rel(lib_utils_services_courses, lib_utils_services_api, "Makes typed RPC calls via")

  Rel(lib_utils_services_org, lib_utils_store, "Updates org store in")

  Rel(lib_utils_functions, supabase, "Queries DB and authenticates via supabase-js")
```
