# C4 Architecture Model

Generate or update C4 architecture diagrams (Layers 1–3) for ClassroomIO, outputting Mermaid C4 diagrams to `docs/c4/`.

## When to use

Invoke with `/c4-model` when:
- Architecture documentation needs to be created or refreshed
- You need to understand the system's component structure
- A new container or major feature area has been added

## Steps

### 1. Extract component data from AST

Run the extraction script to produce `docs/c4/components.json`:

```bash
cd /workspaces/classroomio && npx tsx .claude/skills/c4-model/extract-components.ts
```

If any warnings about >50 files per component appear, increase the depth:

```bash
DASHBOARD_DEPTH=5 API_DEPTH=3 npx tsx .claude/skills/c4-model/extract-components.ts
```

### 2. Extract database schema (requires `supabase start`)

```bash
bash .claude/skills/c4-model/extract-database.sh
```

This produces `docs/c4/database.md` with tables, foreign keys, and enums in a token-efficient format.

### 3. Generate Mermaid C4 diagrams

Read `docs/c4/components.json` and the conventions in `references/c4-conventions.md`, then generate the following files:

#### `docs/c4/L1-context.md` — System Context (Layer 1)

```markdown
# L1 — System Context

​```mermaid
C4Context
  title ClassroomIO — System Context

  Person(student, "Student", "Learner enrolled in courses")
  Person(instructor, "Instructor", "Creates and manages courses")
  Person(admin, "Org Admin", "Manages organization settings")

  System(classroomio, "ClassroomIO", "Open-source LMS for organizations")

  System_Ext(supabase, "Supabase", "Auth, Postgres DB, Storage")
  System_Ext(email, "Email Provider", "Transactional email delivery")
  System_Ext(posthog, "PostHog", "Product analytics")
  System_Ext(sentry, "Sentry", "Error tracking")
  System_Ext(polar, "Polar", "Payment processing")
  System_Ext(unsplash, "Unsplash", "Stock image API")

  Rel(student, classroomio, "Uses")
  Rel(instructor, classroomio, "Uses")
  Rel(admin, classroomio, "Manages")
  Rel(classroomio, supabase, "Reads/writes data", "HTTP/SQL")
  Rel(classroomio, email, "Sends emails", "SMTP/API")
  Rel(classroomio, posthog, "Sends events", "HTTP")
  Rel(classroomio, sentry, "Reports errors", "HTTP")
  Rel(classroomio, polar, "Processes payments", "HTTP")
  Rel(classroomio, unsplash, "Fetches images", "HTTP")
​```
```

#### `docs/c4/L2-container.md` — Container (Layer 2)

```markdown
# L2 — Containers

​```mermaid
C4Container
  title ClassroomIO — Container Diagram

  Person(user, "User", "Student, Instructor, or Admin")

  System_Boundary(cio, "ClassroomIO") {
    Container(dashboard, "Dashboard", "SvelteKit + Svelte 4", "Main LMS web app — courses, org management, LMS student view")
    Container(api, "API Service", "Hono + TypeScript", "PDF processing, video uploads, email/notifications")
    Container(website, "Marketing Site", "SvelteKit + mdsvex", "Landing page at classroomio.com")
    Container(docs, "Docs", "React + Fumadocs", "Documentation site")
  }

  ContainerDb(db, "Postgres", "Supabase", "Primary data store")
  Container_Ext(auth, "Supabase Auth", "Supabase", "Authentication & JWT")
  Container_Ext(storage, "Supabase Storage", "Supabase", "File/image storage")
  Container_Ext(email, "Email Provider", "", "Transactional emails")

  Rel(user, dashboard, "Uses", "HTTPS")
  Rel(user, website, "Visits", "HTTPS")
  Rel(user, docs, "Reads", "HTTPS")
  Rel(dashboard, api, "Calls", "HTTP/RPC")
  Rel(dashboard, db, "Queries", "HTTP")
  Rel(dashboard, auth, "Authenticates", "HTTP")
  Rel(dashboard, storage, "Uploads/downloads", "HTTP")
  Rel(api, db, "Queries", "HTTP")
  Rel(api, email, "Sends", "SMTP/API")
​```
```

#### `docs/c4/L3-dashboard.md` — Dashboard Components (Layer 3)

Generate from `components.json`. Use `Container_Boundary` for the dashboard, one `Component` per entry. Map `dependsOn` to `Rel` edges. Skip components with <3 total files unless they have cross-component relationships. Example structure:

```mermaid
C4Component
  title Dashboard — Component Diagram

  Container_Boundary(dashboard, "Dashboard (SvelteKit)") {
    Component(routes_org, "Org Routes", "SvelteKit", "Organization management pages")
    Component(routes_course, "Course Routes", "SvelteKit", "Course viewing/editing pages")
    Component(lib_components_course, "Course Components", "Svelte", "Course UI components")
    Component(lib_utils_services, "Services", "TypeScript", "API service layer")
    Component(lib_utils_store, "Stores", "Svelte Store", "Client-side state management")
    ...
  }

  ContainerDb(db, "Supabase", "Postgres")
  Container_Ext(api_ext, "API Service", "Hono")

  Rel(routes_org, lib_components_org, "Renders")
  Rel(lib_utils_services, db, "Queries")
  ...
```

#### `docs/c4/L3-api.md` — API Components (Layer 3)

Same approach for the API container. Components will typically be: routes, services, middlewares, config, utils, types.

### 4. Validate

- Verify no component has >50 files (check warnings from step 1)
- Ensure all cross-component relationships from the JSON are represented
- Confirm diagrams render (Mermaid syntax check)

## Output files

| File | Content |
|------|---------|
| `docs/c4/components.json` | Raw AST extraction (git-ignored) |
| `docs/c4/database.md` | DB schema in compact format |
| `docs/c4/L1-context.md` | System Context diagram |
| `docs/c4/L2-container.md` | Container diagram |
| `docs/c4/L3-dashboard.md` | Dashboard component diagram |
| `docs/c4/L3-api.md` | API component diagram |

## References

- `references/c4-conventions.md` — C4 + Mermaid syntax conventions for this project
- https://c4model.com/abstractions/component — Layer 3 granularity guidelines
- https://mermaid.js.org/syntax/c4.html — Mermaid C4 syntax
