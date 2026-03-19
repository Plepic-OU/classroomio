# Skill: C4 Architecture Model

Generate or update C4 architecture diagrams (Layers 1–3) for ClassroomIO.
Outputs Mermaid C4 diagrams to `docs/c4/`. Layer 3 component diagrams are
derived from AST extraction — never hardcoded.

References:
- `.claude/skills/c4-model/references/c4-conventions.md` — C4 model rules
- `.claude/skills/c4-model/references/mermaid-syntax.md` — Mermaid C4 syntax
- `.claude/skills/c4-model/extract.ts` — AST extraction script

---

## Invocation

```
/c4-model [target]
```

`target` (optional, default = `all`):
- `all` — regenerate all diagrams and database schema
- `context` — Layer 1 only
- `containers` — Layer 2 only
- `components` — Layer 3 only (both dashboard and api)
- `database` — database schema only

---

## Step 0 — Prerequisites

Check whether `ts-morph` and `tsx` are available:

```bash
node -e "require('ts-morph')" 2>/dev/null && echo ok || echo missing
```

If missing, install them (workspace root, dev-only):

```bash
pnpm add -w -D ts-morph tsx
```

---

## Step 1 — Run AST extraction (for `components` or `all`)

```bash
npx tsx .claude/skills/c4-model/extract.ts
```

This writes two JSON files:
- `docs/c4/components-dashboard.json`
- `docs/c4/components-api.json`

These files are gitignored (intermediate artefacts). Read them immediately after
generating — do not skip even if they already exist, as they may be stale.

### Reading the JSON

Each file has this shape:

```jsonc
{
  "app": "dashboard",
  "components": {
    "routes/courses": {
      "key": "routes/courses",
      "label": "courses",
      "tsFiles": 4,
      "svelteFiles": 7,
      "relations": ["lib/components/Course", "routes/api"]
    }
    // ...
  },
  "warnings": []
}
```

**Depth warnings**: if `warnings` is non-empty, some components contain >50 files.
This means the depth setting in `extract.ts` APPS config is too shallow. Increase
`defaultDepth` or add a `pathDepthOverride` for the offending prefix, re-run, and
continue only when warnings are resolved.

### Pruning for diagrams

The raw JSON may contain 40–80+ component keys. For a readable L3 diagram, apply
these rules before generating Mermaid:

1. **Drop trivial keys**: keys named `src-root` or that contain only 1 ts file and
   0 svelte files (likely barrel/config files) unless they are depended upon.
2. **Collapse leaf-only nodes**: if a component has relations pointing to it but
   zero outgoing relations and <3 files, treat it as a sub-component of its parent.
3. **Cap at 20 nodes per diagram**. If there are more meaningful components, split
   into sub-diagrams by boundary (e.g. `routes`, `lib`, `api`).
4. **Prune high-fan-out edges**: if one component imports 10+ others, show only the
   5–6 most architecturally significant ones (routes→lib is obvious; skip it).

---

## Step 2 — Generate Layer 1: System Context

Write `docs/c4/context.md`.

Use the static template below — it reflects the current ClassroomIO architecture.
Only regenerate this file if explicitly asked or if external systems have changed.

```markdown
# C4 Layer 1 — System Context

> ClassroomIO: open-source LMS for teaching and learning.

\```mermaid
C4Context
  title System Context — ClassroomIO

  Person(instructor, "Instructor", "Creates courses, grades students")
  Person(student, "Student", "Enrols, completes exercises")
  Person(admin, "Org Admin", "Manages organisation and billing")

  System(classroomio, "ClassroomIO", "LMS platform: course creation, delivery, grading, community")

  System_Ext(supabase, "Supabase", "PostgreSQL, Auth, Realtime, Storage")
  System_Ext(redis, "Redis (Upstash)", "Rate limiting, session cache")
  System_Ext(s3, "AWS S3", "File and media storage")
  System_Ext(email, "ZeptoMail / Nodemailer", "Transactional email")
  System_Ext(payments, "Stripe / Polar", "Subscription billing")
  System_Ext(posthog, "PostHog", "Product analytics")
  System_Ext(sentry, "Sentry", "Error monitoring")
  System_Ext(openai, "OpenAI", "AI grading and exercise generation")

  Rel(instructor, classroomio, "Uses", "HTTPS")
  Rel(student, classroomio, "Uses", "HTTPS")
  Rel(admin, classroomio, "Manages", "HTTPS")
  Rel(classroomio, supabase, "Persists data", "Supabase JS / HTTP")
  Rel(classroomio, redis, "Caches / rate-limits", "ioredis")
  Rel(classroomio, s3, "Stores files", "AWS SDK / presigned URL")
  Rel(classroomio, email, "Sends notifications", "SMTP / API")
  Rel(classroomio, payments, "Processes payments", "HTTPS")
  Rel(classroomio, openai, "AI features", "HTTP / Vercel AI SDK")
\```
```

---

## Step 3 — Generate Layer 2: Container Diagram

Write `docs/c4/containers.md`.

Use the static template below. Only regenerate if the container topology changes.

```markdown
# C4 Layer 2 — Container Diagram

\```mermaid
C4Container
  title Container Diagram — ClassroomIO

  Person(user, "Instructor / Student / Admin")

  System_Boundary(classroomio, "ClassroomIO") {
    Container(dashboard, "Dashboard", "SvelteKit / TypeScript / Tailwind", "Web UI with SSR. Handles course management, student portal, org admin.")
    Container(api, "API", "Hono / Node.js / TypeScript", "REST backend. AI grading, email, S3 presigned URLs, rate limiting.")
    ContainerDb(db, "Supabase", "PostgreSQL 15 + PostgREST + Auth + Realtime + Storage", "All persistent data: users, orgs, courses, lessons, exercises, submissions.")
    Container(edge, "Edge Functions", "Deno / Supabase Functions", "grades-tmp (AI grading pipeline), notify (push notifications).")
  }

  System_Ext(redis, "Redis (Upstash)", "Rate limiting, API cache")
  System_Ext(s3, "AWS S3", "Binary file storage")
  System_Ext(email, "ZeptoMail", "Transactional email")
  System_Ext(openai, "OpenAI", "LLM completions")
  System_Ext(payments, "Stripe / Polar", "Billing")

  Rel(user, dashboard, "Uses", "HTTPS / browser")
  Rel(dashboard, api, "Calls", "HTTPS / fetch")
  Rel(dashboard, db, "Reads/writes directly", "Supabase JS SDK (auth-gated)")
  Rel(api, db, "Reads/writes", "Supabase JS SDK")
  Rel(api, redis, "Rate-limits / caches", "ioredis")
  Rel(api, s3, "Issues presigned URLs", "AWS SDK v3")
  Rel(api, email, "Sends email", "Nodemailer / ZeptoMail API")
  Rel(api, openai, "Generates completions", "Vercel AI SDK")
  Rel(api, payments, "Webhooks + checkout", "HTTPS")
  Rel(edge, db, "Reads/writes", "Supabase client (Deno)")
\```
```

---

## Step 4 — Generate Layer 3: Component Diagrams

Generate two files from the extracted JSON:

### 4a — `docs/c4/components-dashboard.md`

Read `docs/c4/components-dashboard.json`. Map component keys to the diagram using
these groupings as `Container_Boundary` blocks:

| Boundary label | Key prefix(es) |
|---|---|
| Routes | `routes/` |
| UI Components | `lib/components/` |
| Server API Routes | `routes/api/` (sub-group of Routes if present) |
| Lib / Shared | `lib/` but not `lib/components/` |
| Mail | `mail/` |

Pruning: apply the rules from Step 1. Aim for ≤ 20 nodes.

Relationships: draw an edge from A → B only if `B` appears in `A.relations`.
Skip edges where both endpoints map to the same boundary (internal noise).
Label the most important edges with the interaction type (e.g. "Supabase SDK",
"fetch", "stores").

Example skeleton (fill from JSON):

```markdown
# C4 Layer 3 — Dashboard Components

\```mermaid
C4Component
  title Component Diagram — Dashboard

  Container_Boundary(dashboard, "Dashboard") {

    Container_Boundary(routes_b, "Routes") {
      Component(routes_courses, "courses", "SvelteKit pages", "Course listing and detail")
      Component(routes_org, "org", "SvelteKit pages", "Org management")
      Component(routes_lms, "lms", "SvelteKit pages", "Student portal")
      Component(routes_api, "api routes", "SvelteKit server endpoints", "BFF handlers: AI, email, analytics")
    }

    Container_Boundary(components_b, "UI Components") {
      Component(comp_course, "Course", "Svelte", "Lesson, exercise, people, certificates")
      Component(comp_courses, "Courses", "Svelte", "Course cards, creation modal")
      Component(comp_lms, "LMS", "Svelte", "Student-facing course UI")
      Component(comp_auth, "AuthUI", "Svelte", "Login, signup, onboarding")
      Component(comp_ai, "AI", "Svelte", "AI prompt button, grading UI")
      Component(comp_nav, "Navigation", "Svelte", "Sidebar, top nav")
    }

    Container_Boundary(lib_b, "Lib / Shared") {
      Component(lib_utils, "utils", "TypeScript", "Shared helpers, stores, Supabase client")
    }

    Component(mail, "mail", "HTML / TypeScript", "Email templates")
  }

  Rel(routes_courses, comp_course, "Uses")
  Rel(routes_lms, comp_lms, "Uses")
  Rel(routes_api, lib_utils, "Uses", "Supabase SDK")
  Rel(routes_api, mail, "Renders")
  Rel(comp_course, lib_utils, "Uses", "stores, utils")
  Rel(comp_ai, routes_api, "Calls", "fetch")
\```
```

### 4b — `docs/c4/components-api.md`

Read `docs/c4/components-api.json`. Map component keys:

| Boundary label | Key prefix(es) |
|---|---|
| Routes | `routes/` |
| Services | `services/` |
| Middleware | `middlewares/` |
| Utils | `utils/` |
| Config / Types | `config/`, `types/`, `constants/` |

Example skeleton (fill from JSON):

```markdown
# C4 Layer 3 — API Components

\```mermaid
C4Component
  title Component Diagram — API (Hono)

  Container_Boundary(api, "API") {

    Container_Boundary(routes_b, "Routes") {
      Component(routes_course, "course routes", "Hono router", "Course CRUD, lesson, exercise endpoints")
    }

    Container_Boundary(services_b, "Services") {
      Component(svc_course, "course service", "TypeScript", "Business logic for course operations")
    }

    Container_Boundary(utils_b, "Utilities") {
      Component(utils_auth, "auth utils", "TypeScript", "JWT validation, session helpers")
      Component(utils_redis, "redis utils", "TypeScript", "Rate limiting, cache helpers")
      Component(utils_openapi, "openapi utils", "TypeScript", "Schema generation, spec upload")
    }

    Component(middlewares, "middlewares", "Hono middleware", "Auth, rate limit, CORS, error handling")
    Component(config, "config", "TypeScript", "Env config, app setup")
  }

  Rel(routes_course, svc_course, "Delegates to")
  Rel(routes_course, middlewares, "Uses")
  Rel(svc_course, utils_auth, "Uses")
  Rel(middlewares, utils_redis, "Uses", "rate limiting")
  Rel(middlewares, utils_auth, "Uses", "JWT check")
\```
```

---

## Step 5 — Extract Database Schema

**Requires**: `supabase start` must be running locally.

Run the following to extract schema from the local Supabase postgres container:

```bash
# Tables + columns (compact format)
docker exec supabase_db_classroomio psql -U postgres -t -A -F'|' -c "
SELECT c.table_name, c.column_name, c.data_type,
       c.is_nullable, c.column_default IS NOT NULL AS has_default
FROM information_schema.columns c
JOIN information_schema.tables t
  ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE c.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position;
" 2>/dev/null

# Foreign keys
docker exec supabase_db_classroomio psql -U postgres -t -A -F'|' -c "
SELECT tc.table_name, kcu.column_name,
       ccu.table_name AS ref_table, ccu.column_name AS ref_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
" 2>/dev/null

# Enum types
docker exec supabase_db_classroomio psql -U postgres -t -A -F'|' -c "
SELECT t.typname, e.enumlabel
FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
ORDER BY t.typname, e.enumsortorder;
" 2>/dev/null
```

If the container is not running, note in `docs/c4/database.md`:
> Schema extraction requires `supabase start`. Run the skill again with Supabase running.

### Format for `docs/c4/database.md`

Write a token-efficient markdown file — no full DDL. Use this structure:

```markdown
# Database Schema (ClassroomIO — public schema)

> Extracted from local Supabase (PostgreSQL 15). Run `/c4-model database` to refresh.

## Tables

### profiles
| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | NO | FK → auth.users |
| full_name | text | YES | |
| avatar_url | text | YES | |
| ...

### organizations
...

## Foreign Key Map

| Table | Column | References |
|---|---|---|
| profiles | id | auth.users.id |
| ...

## Enum Types

| Type | Values |
|---|---|
| course_status | draft, published, archived |
| ...
```

---

## Output files summary

| File | Layer | Regenerated by |
|---|---|---|
| `docs/c4/context.md` | L1 | `all`, `context` |
| `docs/c4/containers.md` | L2 | `all`, `containers` |
| `docs/c4/components-dashboard.md` | L3 | `all`, `components` |
| `docs/c4/components-api.md` | L3 | `all`, `components` |
| `docs/c4/database.md` | Schema | `all`, `database` |
| `docs/c4/components-*.json` | Intermediate | `extract.ts` (gitignored) |
