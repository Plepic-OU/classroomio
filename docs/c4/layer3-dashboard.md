# C4 Level 3 — Dashboard Container Components

> **Scope:** Internal components of `apps/dashboard` (`@cio/dashboard`).  
> **Derived from:** `docs/c4/ast-dashboard.json` (AST extraction at depth=3, 2026-05-15).  
> **Source:** `apps/dashboard/src/` — 432 TS/JS files + 297 Svelte files across 104 depth-3 components,  
> aggregated to depth-2 for diagram readability (9 architectural groups shown).  
> **Depth warnings:** `lib/components/Course` (91 files) and `lib/utils/functions` (52 files) — both are intentionally large; increasing depth=4 would fragment them without benefit.

```mermaid
C4Component
  Container_Boundary(dash_boundary, "Dashboard — @cio/dashboard · SvelteKit(1) · Svelte(2)") {

    Component(c_routes_lms, "routes/lms", "SvelteKit(1) · Svelte(2)", "Student learning pages: active courses, exercise submission, community feed, explore, and account settings. 10 TS/JS files + Svelte pages.")

    Component(c_routes_org, "routes/org", "SvelteKit(1) · Svelte(2)", "Teacher and admin pages: course builder, lesson editor, grading, analytics dashboard, org settings, and team management. 22 TS/JS files.")

    Component(c_routes_courses, "routes/courses", "SvelteKit(1) · Svelte(2)", "Course listing and management pages for teachers: create, edit, duplicate, and delete courses. 27 TS/JS + Svelte files.")

    Component(c_routes_api, "routes/api", "SvelteKit(1) · OpenAI(13) · Polar(19)", "34 SvelteKit server endpoints grouped by domain: AI completions, analytics, course data, email, file uploads, org, and Polar billing webhooks. Never exposed to the browser directly.")

    Component(c_routes_course, "routes/course", "SvelteKit(1) · Svelte(2)", "Public course landing pages at /course/[slug]. SEO-optimised with svelte-meta-tags; accessible without authentication.")

    Component(c_routes_auth, "routes (auth)", "SvelteKit(1) · Svelte(2)", "Authentication flow pages: login, signup, forgot password, reset, email verification, and logout. 5 route files plus small single-page routes.")

    Component(c_lib_components, "lib/components", "Svelte(2) · Carbon(17) · Tailwind(18)", "51 reusable Svelte component directories: AI chat, Analytics charts, Course viewer, LMS exercise renderer, Org management forms, modals, navigation, upload widgets, and 40+ UI primitives. 291 files total.")

    Component(c_lib_utils, "lib/utils", "TypeScript(9) · Supabase(5)", "96 TS files across 5 sub-groups: services/ (Supabase and API clients, domain services), store/ (Svelte reactive stores for app, user, org, attendance), functions/ (50+ pure utilities), constants/ (route names, roles, quiz config), types/ (TypeScript interfaces).")

    Component(c_mail, "mail", "SvelteKit(1)", "mail/sendEmail.ts — server-side email dispatch helper invoked by routes/api email endpoints. Delegates to the API container for actual delivery.")
  }

  Component_Ext(ext_supabase, "Supabase (5)(6)(7)(8)", "DB, Auth, Realtime")
  Component_Ext(ext_api, "API container (3)(4)", "@cio/api via HTTP")
  Component_Ext(ext_openai, "OpenAI (13)", "GPT-4 completions")
  Component_Ext(ext_polar, "Polar (19)", "Billing and subscriptions")

  Rel(c_routes_lms, c_lib_components, "renders")
  Rel(c_routes_lms, c_lib_utils, "reads stores and calls services")

  Rel(c_routes_org, c_lib_components, "renders")
  Rel(c_routes_org, c_lib_utils, "reads stores and calls services")

  Rel(c_routes_courses, c_lib_components, "renders")
  Rel(c_routes_courses, c_lib_utils, "reads stores and calls services")

  Rel(c_routes_course, c_lib_utils, "reads course data")

  Rel(c_routes_auth, c_lib_utils, "reads auth store, calls auth services")

  Rel(c_routes_api, c_lib_utils, "calls services and reads config")
  Rel(c_routes_api, c_mail, "invokes for email dispatch")
  Rel(c_routes_api, ext_openai, "AI completions", "HTTPS — server only")
  Rel(c_routes_api, ext_polar, "billing webhooks and checkout", "HTTPS")

  Rel(c_lib_components, c_lib_utils, "uses stores and helper functions")

  Rel(c_lib_utils, ext_supabase, "reads/writes data, subscribes to events", "Supabase JS SDK")
  Rel(c_lib_utils, ext_api, "delegates long-running tasks", "HTTP + rpc-types.ts(9)")
```

---

## What is AST?

An **Abstract Syntax Tree (AST)** is a tree-shaped data structure that represents source code structure without whitespace, comments, or syntactic sugar. Every construct in the language — an `import` statement, a function definition, a class declaration — becomes a node, with children representing its sub-constructs.

This diagram was derived by running `ts-morph` (a TypeScript compiler API wrapper) over every `.ts`/`.js` file in `apps/dashboard/src/`. For each file, the extractor reads its import declarations and resolves each module specifier — including `$lib/...` path aliases read from `tsconfig.json` — to either another file in the codebase (internal) or an npm package name (external). Files are grouped by their first 3 directory segments below `src/` (depth=3). The 104 resulting components are then aggregated one level higher to 9 depth-2 groups for this diagram. `.svelte` files cannot be parsed by ts-morph; they are counted as metadata (`svelteCount`) alongside their co-located `.ts` files.

---

## Tech Stack Footnotes

| # | Technology | Description |
|---|-----------|-------------|
| 1 | **SvelteKit 1.x** | Full-stack Svelte framework with file-based routing (`src/routes/`), server-side rendering, server actions (`+page.server.ts`), and API endpoints (`+server.ts`). Provides the routing backbone for all LMS, org, course, auth, and API route groups. |
| 2 | **Svelte 4** | Reactive UI component compiler that outputs vanilla JavaScript with zero runtime framework overhead. All 51 component directories under `lib/components/` are Svelte 4 `.svelte` files using `$:` reactive declarations and `<script lang="ts">`. |
| 5 | **Supabase** | Open-source Firebase alternative providing managed PostgreSQL, Auth, Realtime, and Storage. The Dashboard's `lib/utils` services layer wraps `@supabase/supabase-js` for all data access and uses Supabase Realtime for live feed subscriptions. |
| 6 | **PostgreSQL** | Relational database backing all persistent data. Accessed exclusively through the Supabase JS SDK from `lib/utils/services` — no raw SQL from the Dashboard. |
| 7 | **Supabase Auth** | JWT-based authentication. The Dashboard uses `@supabase/supabase-js` to manage sessions, protected routes check the session in SvelteKit hooks (`src/hooks.server.ts`), and the auth store exposes the user to all components. |
| 8 | **Supabase Realtime** | WebSocket subscriptions to PostgreSQL row changes. Used in `lib/utils/services` to push live updates to the org feed and notification bell without polling. |
| 9 | **TypeScript** | Statically typed superset of JavaScript used for all Dashboard source files. The `rpc-types.ts` import from `@cio/api` gives compile-time types for all API container calls made from `routes/api`. |
| 13 | **OpenAI GPT-4** | Completions API used for AI grading, exercise generation, and custom prompts. Accessed exclusively from `routes/api/completion/` server endpoints — never from Svelte components or browser code. |
| 17 | **Carbon Design System** | IBM's open-source design system providing Svelte components (`carbon-components-svelte`) and data visualisation (`@carbon/charts-svelte`). Used for tables, data grids, and analytics charts in the org admin and analytics views. |
| 18 | **Tailwind CSS** | Utility-first CSS framework providing base styling for all Dashboard pages and components. Configured with `@tailwindcss/forms` and `@tailwindcss/typography` plugins. |
| 19 | **Polar** | Open-source billing and subscription platform. The `routes/api/polar/` endpoints handle checkout sessions, subscription webhooks, and the customer portal via `@polar-sh/sveltekit`. |
