# C4 Model Skill

Generates or updates C4 architecture diagrams (Layers 1–3) for ClassroomIO and optionally extracts the database schema. All output goes to `docs/c4/`.

## Invocation

```
/c4-model           → Full run: extract AST + generate all diagrams
/c4-model db        → Database schema extraction only
/c4-model diagrams  → Regenerate diagrams from existing components.json (skip extract)
```

## References

Before running, read:
- `.claude/skills/c4-model/references/c4-conventions.md` — C4 abstraction rules and ClassroomIO-specific decisions
- `.claude/skills/c4-model/references/mermaid-c4-syntax.md` — Mermaid C4 syntax cheatsheet

---

## Step 1 — Install script dependencies (first run or after package.json changes)

```bash
cd .claude/skills/c4-model && pnpm install --ignore-workspace
```

## Step 2 — Run AST extraction (skip if invoked with `diagrams` argument)

```bash
cd .claude/skills/c4-model && pnpm exec tsx extract.ts
```

This writes `docs/c4/components.json`. Read the file and check the console output:
- If any component has >50 files, the depth is too shallow. Edit `APPS[n].depth` in `extract.ts` and re-run.
- Report how many components were found per app.

## Step 3 — Generate Layer 1: System Context

Write `docs/c4/L1-context.md` with this content:

````markdown
# L1: System Context

```mermaid
C4Context
  title ClassroomIO — System Context

  Person(admin, "Admin / Teacher", "Creates courses, manages org")
  Person(student, "Student", "Takes courses, submits exercises")

  System_Boundary(cio, "ClassroomIO") {
    System(dashboard, "Dashboard", "Main LMS web app (SvelteKit)")
    System(api, "API", "Backend service (Hono/Node.js)")
  }

  System_Ext(supabase, "Supabase", "Auth, PostgreSQL DB, file storage")
  System_Ext(s3, "AWS S3", "Video and file storage")
  System_Ext(email, "Email (SMTP)", "Transactional email delivery")
  System_Ext(posthog, "PostHog", "Product analytics")
  System_Ext(sentry, "Sentry", "Error monitoring")
  System_Ext(polar, "Polar", "Payments and subscriptions")
  System_Ext(unsplash, "Unsplash", "Stock image search")

  Rel(admin, dashboard, "Uses", "HTTPS")
  Rel(student, dashboard, "Uses", "HTTPS")
  Rel(dashboard, api, "Calls for heavy ops", "HTTPS / Hono RPC")
  Rel(dashboard, supabase, "Auth + DB + storage", "PostgREST / GoTrue / S3")
  Rel(api, supabase, "Reads/Writes DB", "SQL")
  Rel(api, s3, "Uploads / presigns", "HTTPS")
  Rel(api, email, "Sends", "SMTP")
  Rel(dashboard, posthog, "Tracks events", "HTTPS")
  Rel(dashboard, sentry, "Reports errors", "HTTPS")
  Rel(dashboard, polar, "Manages billing", "HTTPS")
  Rel(dashboard, unsplash, "Fetches images", "HTTPS")
```
````

## Step 4 — Generate Layer 2: Container Diagram

Write `docs/c4/L2-containers.md`:

````markdown
# L2: Container Diagram

```mermaid
C4Container
  title ClassroomIO — Containers

  Person(admin, "Admin / Teacher")
  Person(student, "Student")

  System_Boundary(cio, "ClassroomIO") {
    Container(dashboard, "Dashboard", "SvelteKit / :5173", "Main LMS UI — org admin + student portal")
    Container(api, "API", "Hono / Node.js / :3002", "PDF generation, S3 presign, email, course clone")
    Container(mktg, "Marketing Site", "SvelteKit / :5174", "Public landing pages — classroomio.com")
    Container(courseApp, "Course App", "Next.js / React", "Embeddable course viewer widget")
    Container(edge, "Edge Functions", "Deno / Supabase", "Notifications, grade processing triggers")
    ContainerDb(db, "PostgreSQL", "Supabase", "Primary data store — RLS policies per org/role")
    Container(auth, "Auth", "Supabase GoTrue", "JWT-based authentication")
    Container(storage, "Storage", "Supabase / S3-compat", "Images, videos, attachments")
  }

  System_Ext(s3, "AWS S3", "Large file / video storage")
  System_Ext(email, "SMTP", "Transactional email")
  System_Ext(posthog, "PostHog")
  System_Ext(sentry, "Sentry")
  System_Ext(polar, "Polar")

  Rel(admin, dashboard, "Uses", "HTTPS")
  Rel(student, dashboard, "Uses", "HTTPS")
  Rel(dashboard, api, "Heavy ops", "HTTPS / Hono RPC")
  Rel(dashboard, db, "CRUD", "PostgREST")
  Rel(dashboard, auth, "Login / session", "GoTrue API")
  Rel(dashboard, storage, "Upload / fetch", "S3-compat API")
  Rel(api, db, "Reads/Writes", "SQL")
  Rel(api, s3, "Uploads / presigns", "HTTPS")
  Rel(api, email, "Sends", "SMTP")
  Rel(edge, db, "Reacts to changes", "Supabase webhooks")
  Rel(dashboard, posthog, "Analytics", "HTTPS")
  Rel(dashboard, sentry, "Errors", "HTTPS")
  Rel(dashboard, polar, "Billing", "HTTPS")
```
````

## Step 5 — Generate Layer 3: Dashboard Component Diagram

Read `docs/c4/components.json` → `dashboard.components`. Apply these rules:

**Grouping into C4 components:**

Map component keys to logical C4 components as follows. If the JSON has components not listed below, include them using their label.

| Component key prefix | C4 Component label | Tech |
|---------------------|--------------------|------|
| `routes/org` | Org Admin Routes | SvelteKit routes |
| `routes/lms` | LMS Routes | SvelteKit routes |
| `routes/course` | Course Viewer Routes | SvelteKit routes |
| `routes/api` | Server API Routes | SvelteKit server endpoints |
| `routes/` (other) | Auth & Misc Routes | SvelteKit routes |
| `lib/components/AI` | AI Components | Svelte |
| `lib/components/Course` | Course Components | Svelte |
| `lib/components/LMS` | LMS Components | Svelte |
| `lib/components/Org` | Org Components | Svelte |
| `lib/components/Navigation` | Navigation | Svelte |
| `lib/components/` (other UI) | Shared UI Components | Svelte |
| `lib/utils/services` | Services (Data Layer) | TypeScript |
| `lib/utils/store` | Svelte Stores | Svelte/TS |
| `lib/utils/functions` | Utility Functions | TypeScript |
| `lib/utils/constants` | Constants & Routes | TypeScript |
| `lib/utils/types` | Types | TypeScript |
| `lib/utils/translations` | i18n Translations | TypeScript |

Derive relationships by aggregating `relationships` arrays from the JSON components within each group.

Write `docs/c4/L3-dashboard.md`:

````markdown
# L3: Dashboard Components

> Derived from AST extraction — do not edit manually.
> Re-generate with `/c4-model diagrams`.

```mermaid
C4Component
  title Dashboard — Components

  Container_Boundary(dashboard, "Dashboard (SvelteKit)") {
    Component(orgRoutes, "Org Admin Routes", "SvelteKit", "Course/audience/community/settings/quiz management")
    Component(lmsRoutes, "LMS Routes", "SvelteKit", "Student portal — mylearning, explore, exercises")
    Component(courseRoutes, "Course Viewer Routes", "SvelteKit", "Public course viewer by slug")
    Component(apiRoutes, "Server API Routes", "SvelteKit server", "Internal API endpoints — analytics, email, domain")
    Component(authRoutes, "Auth & Misc Routes", "SvelteKit", "Login, signup, invite, onboarding, profile")

    Component(aiComp, "AI Components", "Svelte", "AI-assisted grading and content UI")
    Component(courseComp, "Course Components", "Svelte", "Lesson, exercise, progress UI")
    Component(lmsComp, "LMS Components", "Svelte", "Student-facing learning UI")
    Component(orgComp, "Org Components", "Svelte", "Org settings and team management UI")
    Component(navComp, "Navigation", "Svelte", "Top nav, sidebar, org selector")
    Component(sharedUI, "Shared UI Components", "Svelte", "Buttons, modals, forms, avatars, chips")

    Component(services, "Services (Data Layer)", "TypeScript", "Supabase PostgREST + RPC wrappers, API client")
    Component(stores, "Svelte Stores", "Svelte/TS", "currentOrg, profile, user — global reactive state")
    Component(utils, "Utility Functions", "TypeScript", "Date, slug, uuid, course logic, supabase client")
    Component(constants, "Constants & Routes", "TypeScript", "Route paths, role IDs, plan constants")
    Component(i18n, "i18n Translations", "TypeScript", "en/fr/de/es translation keys")
  }

  System_Ext(supabaseExt, "Supabase", "Auth + DB + Storage")
  System_Ext(apiExt, "API Service", "Hono backend")

  Rel(orgRoutes, orgComp, "Renders")
  Rel(orgRoutes, courseComp, "Renders")
  Rel(lmsRoutes, lmsComp, "Renders")
  Rel(courseRoutes, courseComp, "Renders")
  Rel(orgRoutes, services, "Calls")
  Rel(lmsRoutes, services, "Calls")
  Rel(courseRoutes, services, "Calls")
  Rel(apiRoutes, services, "Calls")
  Rel(authRoutes, services, "Calls")
  Rel(services, stores, "Updates")
  Rel(services, supabaseExt, "PostgREST / RPC", "HTTPS")
  Rel(services, apiExt, "Hono RPC", "HTTPS")
  Rel(orgComp, stores, "Reads")
  Rel(lmsComp, stores, "Reads")
  Rel(courseComp, stores, "Reads")
  Rel(navComp, stores, "Reads")
  Rel(services, utils, "Uses")
  Rel(services, constants, "Uses")
  Rel(orgRoutes, i18n, "Uses")
  Rel(lmsRoutes, i18n, "Uses")
```
````

**After writing:** Refine the `Rel()` lines using the actual `relationships` data from `components.json` — remove relationships that have no evidence in the AST, and add any cross-group relationships the AST reveals but the template doesn't show.

## Step 6 — Generate Layer 3: API Component Diagram

Read `docs/c4/components.json` → `api.components`.

Write `docs/c4/L3-api.md` using `C4Component` with a `Container_Boundary` for the API. For each component key in the JSON, create one `Component(...)` entry. Use `label` from the JSON as the component label.

Derive `Rel()` entries from the `relationships` field in the JSON — only include cross-component relationships within the API boundary plus `Rel` to/from external systems (Supabase, S3, email).

Mark `app` (the Hono app entry point), `index` (server entry), and `rpc-types` as the "API Core" component.

````markdown
# L3: API Components

> Derived from AST extraction — do not edit manually.
> Re-generate with `/c4-model diagrams`.

```mermaid
C4Component
  title API Service — Components

  Container_Boundary(api, "API (Hono/Node.js)") {
    Component(core, "API Core", "Hono", "App bootstrap, middleware registration, RPC type exports")
    Component(courseRoutes, "Course Routes", "Hono", "Certificate PDF, content PDF, KaTeX, S3 presign, clone, lesson")
    Component(mailRoutes, "Mail Routes", "Hono", "Transactional email endpoints")
    Component(courseSvc, "Course Service", "TypeScript", "Business logic for course operations")
    Component(envConfig, "Config", "Zod", "Environment variable validation")
    Component(middlewares, "Middlewares", "Hono", "CORS, rate limiter, secure headers, logger")
    Component(authUtils, "Auth Utils", "TypeScript", "JWT verification helpers")
    Component(openapi, "OpenAPI Utils", "Hono OpenAPI", "Scalar API docs generation")
    Component(redis, "Redis Utils", "TypeScript", "Redis client helpers for rate limiting")
    Component(apiTypes, "Types", "TypeScript", "Course and domain type definitions")
    Component(constants, "Constants", "TypeScript", "Shared API constants")
  }

  System_Ext(db, "Supabase DB", "PostgreSQL")
  System_Ext(s3, "AWS S3", "File storage")
  System_Ext(smtp, "SMTP", "Email delivery")

  Rel(core, middlewares, "Registers")
  Rel(courseRoutes, courseSvc, "Delegates to")
  Rel(courseRoutes, envConfig, "Reads config")
  Rel(courseRoutes, s3, "Presigns / uploads", "HTTPS")
  Rel(courseRoutes, db, "Reads course data", "SQL")
  Rel(mailRoutes, smtp, "Sends", "SMTP")
  Rel(mailRoutes, envConfig, "Reads config")
  Rel(courseSvc, db, "Reads/Writes", "SQL")
  Rel(authUtils, db, "Verifies JWT", "Supabase Auth")
  Rel(middlewares, redis, "Rate limits via")
  Rel(core, openapi, "Mounts docs")
```
````

**After writing:** Replace the hardcoded `Rel()` lines with those derived from `components.json` `relationships` fields, keeping only cross-component edges. Add any missing components found in the JSON.

## Step 7 (Optional) — Extract database schema

Only run if invoked with `db` argument or if `docs/c4/database.md` does not exist and Supabase is running locally.

```bash
cd .claude/skills/c4-model && pnpm exec tsx db-schema.ts
```

If the Supabase container is not running, skip this step and note it in the output.

## Step 8 — Write index

Write or update `docs/c4/README.md`:

```markdown
# C4 Architecture — ClassroomIO

Auto-generated by the `/c4-model` Claude Code skill.

| File | Layer | Description |
|------|-------|-------------|
| [L1-context.md](L1-context.md) | 1 — System Context | Actors and external systems |
| [L2-containers.md](L2-containers.md) | 2 — Containers | Deployable units |
| [L3-dashboard.md](L3-dashboard.md) | 3 — Dashboard | Dashboard component breakdown |
| [L3-api.md](L3-api.md) | 3 — API | API service component breakdown |
| [database.md](database.md) | DB Schema | Table/column/FK reference |

## Regenerating

```bash
/c4-model           # full regeneration
/c4-model diagrams  # skip AST re-extraction
/c4-model db        # database schema only
```
```

## Output summary

Report to the user:
- Files written to `docs/c4/`
- Component counts per app (from JSON)
- Any depth warnings
- Whether database schema was extracted
