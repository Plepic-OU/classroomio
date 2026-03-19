# C4 Layer 3 — Dashboard Components

> Derived from AST extraction. Run `/c4-model components` to refresh.
>
> Pruning applied: 97 raw components → 19 nodes.
> Dropped: single-file UI atoms (Avatar, Modal, Chip, etc.), auth stubs (login/logout/signup/404),
> all `lib/mocks/*` sub-groups (test fixtures only), and trivial barrel files.

```mermaid
C4Component
  title Component Diagram — Dashboard (SvelteKit)

  Container_Boundary(dashboard, "Dashboard") {

    Container_Boundary(routes_b, "Routes") {
      Component(routes_api, "api routes", "SvelteKit server endpoints", "BFF: AI grading, email, analytics, S3 presigned URLs (34 ts)")
      Component(routes_courses, "courses", "SvelteKit pages", "Course listing, creation and management (13 ts, 14 svelte)")
      Component(routes_course, "course", "SvelteKit pages", "Individual course view entry")
      Component(routes_org, "org", "SvelteKit pages", "Organisation admin portal (7 ts, 15 svelte)")
      Component(routes_lms, "lms", "SvelteKit pages", "Student learning portal (9 svelte)")
      Component(routes_invite, "invite", "SvelteKit pages", "Invitation acceptance flow")
    }

    Container_Boundary(components_b, "UI Components") {
      Component(comp_course, "Course", "Svelte", "Course management shell — wraps Lesson, Certificate, People, Analytics, Settings, NewsFeed")
      Component(comp_lesson, "Lesson", "Svelte", "Core lesson viewer and exercise grader (34 svelte, 12 ts)")
      Component(comp_org, "Org", "Svelte", "Organisation management UI (44 svelte)")
      Component(comp_courses, "Courses", "Svelte", "Course card list and creation modal (7 svelte, 3 ts)")
      Component(comp_question, "Question", "Svelte", "Reusable question / exercise renderer")
      Component(comp_navigation, "Navigation", "Svelte", "Sidebar and top navigation bar")
      Component(comp_apps, "Apps", "Svelte", "Third-party app integrations (9 svelte, 6 ts)")
      Component(comp_landing, "CourseLandingPage", "Svelte", "Public-facing course landing page (15 svelte)")
    }

    Container_Boundary(lib_b, "Lib / Shared") {
      Component(lib_services, "services", "TypeScript", "Supabase queries and domain business logic (21 ts)")
      Component(lib_functions, "functions", "TypeScript", "Shared utility helpers (44 ts)")
      Component(lib_store, "store", "Svelte stores", "Global reactive application state (5 ts)")
      Component(lib_types, "types", "TypeScript", "Shared TypeScript type definitions (9 ts)")
    }

    Component(mail, "mail", "HTML / TypeScript", "Transactional email templates")
  }

  Rel(routes_api, lib_services, "Queries DB", "Supabase JS SDK")
  Rel(routes_api, lib_functions, "Uses helpers")
  Rel(routes_api, mail, "Renders templates")
  Rel(routes_course, lib_services, "Loads course data", "Supabase JS SDK")
  Rel(routes_invite, lib_services, "Validates invitation")
  Rel(routes_invite, lib_functions, "Uses helpers")
  Rel(routes_org, lib_functions, "Uses helpers")
  Rel(comp_course, comp_lesson, "Embeds")
  Rel(comp_lesson, lib_services, "Submits exercises", "Supabase JS SDK")
  Rel(comp_lesson, lib_functions, "Uses helpers")
  Rel(comp_lesson, comp_question, "Renders questions")
  Rel(lib_services, lib_functions, "Uses")
  Rel(lib_services, comp_question, "Uses question types")
  Rel(lib_functions, lib_store, "Reads / writes state")
  Rel(lib_store, lib_types, "Types state shape")
```
