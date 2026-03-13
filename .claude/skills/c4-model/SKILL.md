# Skill: /c4-model

Generate or refresh C4 architecture diagrams (Layers 1–3) for ClassroomIO using AST extraction.

## Usage

```
/c4-model           — Full run: extract AST + generate all layers
/c4-model l1        — Layer 1 (System Context) only
/c4-model l2        — Layer 2 (Containers) only
/c4-model l3        — Layer 3 (Components) for both Dashboard and API
/c4-model db        — DB schema extraction only (requires supabase start)
```

---

## Step 0 — Read conventions

Read `.claude/skills/c4-model/references/c4-conventions.md` before starting. It contains:
- Actor / external system aliases and descriptions
- Container aliases and technologies
- Expected output file names
- Mermaid C4 element syntax
- Diagram quality rules

---

## Step 1 — Install skill dependencies

The skill directory is outside the pnpm workspace, so use **npm** (not pnpm) to install locally:

```bash
cd .claude/skills/c4-model && npm install --silent
```

---

## Step 2 — Run AST extraction (skip for `db` arg)

Use the locally installed tsx binary from the skill's own node_modules:

```bash
node .claude/skills/c4-model/node_modules/.bin/tsx .claude/skills/c4-model/extract.ts
```

Run this from the **repo root** (`/workspaces/classroomio`).

**If it fails:**
- Missing module → re-run `pnpm install` in the skill dir
- tsconfig parse error → check `apps/dashboard/tsconfig.json` for invalid JSON
- Zero components extracted → confirm `apps/dashboard/src` and `apps/api/src` exist

Read the output file:

```
docs/c4/ast-output.json
```

**Check depth warnings** in the script's stdout. If any component has >50 files, note it — you may need to increase `componentDepth` in `extract.ts` for that app before proceeding.

### Interpreting the JSON

`ast-output.json` structure:
```
{
  "apps": {
    "dashboard": {
      "components": {
        "<key>": {
          "tsFileCount": N,
          "svelteCount": N,
          "sampleFiles": ["..."],
          "relationships": ["<other-key>", ...]
        }
      },
      "aliases": { "<alias>": "<relative-path>" },
      "warnings": [...]
    },
    "api": { ... }
  }
}
```

Component keys are `depth`-level directory paths relative to `src/`. Example keys:
- Dashboard: `lib/components/Course`, `lib/utils/services`, `routes/org/[slug]`
- API: `routes/course`, `utils/certificate`, `config`

**Aggregation rules for Layer 3 diagrams** (the raw JSON may have 50+ keys — aggregate before diagramming):

Dashboard — aggregate by this grouping:
| Diagram component | Matches keys starting with |
|---|---|
| `OrgAdminRoutes` | `routes/org` |
| `LMSRoutes` | `routes/lms` |
| `CourseRoutes` | `routes/course` |
| `ServerAPIRoutes` | `routes/api` |
| `AuthRoutes` | `routes/login`, `routes/signup`, `routes/onboarding`, `routes/invite` |
| `UIComponents` | `lib/components` |
| `Services` | `lib/utils/services` |
| `Stores` | `lib/utils/store` |
| `Utilities` | `lib/utils/functions`, `lib/utils/constants` |
| `Types` | `lib/utils/types` |
| `ServerHooks` | `hooks.server.ts` (root file) |

API — aggregate by this grouping:
| Diagram component | Matches keys starting with |
|---|---|
| `CourseRoutes` | `routes/course` |
| `MailRoutes` | `routes/mail` |
| `CourseServices` | `services/course` |
| `CertUtils` | `utils/certificate` |
| `CoursePDFUtils` | `utils/course` |
| `AuthUtils` | `utils/auth` |
| `RedisUtils` | `utils/redis` |
| `Middleware` | `middlewares` |
| `Types` | `types` |
| `Config` | `config` |

For relationships in aggregated diagrams: a relationship between aggregated group A and group B exists if **any** raw component in A has a relationship to **any** raw component in B.

---

## Step 3 — Extract DB schema (full run or `db` arg)

Check if Supabase containers are running:
```bash
docker ps --filter "name=supabase_db_classroomio" --format '{{.Names}}'
```

If the container is running:
```bash
bash .claude/skills/c4-model/db-schema.sh
```

If NOT running, skip DB extraction and add a note in the output files that schema is not available.

---

## Step 4 — Generate diagrams

Create `docs/c4/` if it doesn't exist. Write each diagram as a markdown file containing a fenced Mermaid code block.

### Alias sanitisation

Mermaid aliases must match `[A-Za-z][A-Za-z0-9_]*`. Transform component keys:
- Replace `/`, `-`, `[`, `]`, `.`, `(`, `)` with `_`
- Prefix with `c_` if starts with a digit

Example: `routes/org/[slug]` → `c_routes_org__slug_`
Cleaner: Use the aggregated group names directly (e.g. `OrgAdminRoutes`).

---

### Layer 1 — `docs/c4/context.md`

Write a `C4Context` diagram showing:
- People: `instructor`, `student`
- System: `classroomio` (ClassroomIO LMS)
- External systems (all `System_Ext`): Supabase Auth, ZeptoMail, Cloudflare R2, Polar, PostHog, Sentry, Unsplash
- Relationships from/to classroomio

```markdown
# C4 — Layer 1: System Context

```mermaid
C4Context
  title System Context — ClassroomIO LMS

  Person(instructor, "Instructor", "Creates courses, manages students and content")
  Person(student, "Student", "Enrolls and completes courses")

  System(classroomio, "ClassroomIO LMS", "Open-source learning management system — SvelteKit + Supabase")

  System_Ext(supabase_auth, "Supabase Auth", "JWT authentication and session management")
  System_Ext(zepto_mail, "Email Service", "Transactional email via ZeptoMail / Nodemailer")
  System_Ext(r2, "Cloudflare R2", "Object storage for media and generated PDFs")
  System_Ext(polar, "Polar.sh", "Payment processing and subscription management")
  System_Ext(posthog, "PostHog", "Product analytics and event tracking")
  System_Ext(sentry, "Sentry", "Error monitoring and performance tracing")
  System_Ext(unsplash, "Unsplash", "Stock photography for course covers")

  Rel(instructor, classroomio, "Manages courses, students, settings", "HTTPS")
  Rel(student, classroomio, "Takes courses, submits exercises", "HTTPS")
  Rel(classroomio, supabase_auth, "Authenticates users", "HTTPS")
  Rel(classroomio, zepto_mail, "Sends course and notification emails", "SMTP/HTTPS")
  Rel(classroomio, r2, "Stores and retrieves media files and PDFs", "HTTPS")
  Rel(classroomio, polar, "Processes payments and subscriptions", "HTTPS")
  Rel(classroomio, posthog, "Reports usage events", "HTTPS")
  Rel(classroomio, sentry, "Reports errors and traces", "HTTPS")
  Rel(classroomio, unsplash, "Fetches stock images", "HTTPS")

  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
` ``
```

---

### Layer 2 — `docs/c4/containers.md`

Write a `C4Container` diagram. Use `Enterprise_Boundary` for "ClassroomIO System".

Containers to include:
- `dashboard`: SvelteKit 1.x — LMS frontend (org admin + student)
- `api`: Hono on Node.js — PDF generation, email, file ops, course cloning
- `supabase_api`: PostgREST + GoTrue — Supabase REST/RPC/Auth (port 54321)
- `postgres`: ContainerDb — PostgreSQL 15 via Supabase (port 54322)
- `redis`: ContainerDb — Redis — rate limiting, caching
- `edge_functions`: Deno — Supabase Edge Functions (supabase/functions/)
- `supabase_storage`: Supabase Storage — media blobs (wraps R2/local)

External: `zepto_mail`, `r2` (Cloudflare R2), `polar`, `posthog`, `sentry`

Key relationships:
- `instructor` / `student` → `dashboard` (HTTPS)
- `dashboard` → `api` (HTTP RPC via hcWithType)
- `dashboard` → `supabase_api` (Supabase RPC/REST, JS client)
- `dashboard` → `supabase_api` (Supabase Auth, JWT)
- `api` → `supabase_api` (service-role REST)
- `api` → `redis` (rate limiting)
- `api` → `r2` (S3 SDK — file upload)
- `api` → `zepto_mail` (SMTP — email dispatch)
- `supabase_api` → `postgres` (SQL)
- `edge_functions` → `postgres` (SQL)
- `dashboard` → `supabase_storage` (media upload/download)
- `dashboard` → `posthog` (event tracking)
- `dashboard` → `sentry` (error reporting)
- `dashboard` → `polar` (payment flows)

---

### Layer 3 Dashboard — `docs/c4/components-dashboard.md`

Write a `C4Component` diagram for the Dashboard container.

Use the aggregated group mapping from Step 2. For each group, set:
- **Label**: friendly name (e.g. "Org Admin Routes")
- **Technology**: `SvelteKit routes` / `Svelte components` / `Svelte stores` / `TypeScript` as appropriate
- **Description**: 1-sentence role

Include a `Container_Boundary(dashboard, "Dashboard — SvelteKit")` wrapping all components.

Include relationships derived from the aggregated relationship map.

Also show key **outbound** relationships from the dashboard container to:
- `supabase_api` (from Services, ServerAPIRoutes)
- `api_service` (from Services — Hono RPC)
- `supabase_auth` (from ServerHooks, Utilities)

Use `Container_Ext` for supabase_api and api_service outside the boundary.

---

### Layer 3 API — `docs/c4/components-api.md`

Write a `C4Component` diagram for the API (Hono) container.

Use the API aggregated group mapping. Wrap with `Container_Boundary(api, "API Service — Hono")`.

Include relationships derived from the aggregated relationship map.

Outbound relationships from API to:
- `supabase` (from CourseServices, CertUtils)
- `redis` (from Middleware)
- `r2_storage` — Cloudflare R2 (from CoursePDFUtils)
- `email_service` (from MailRoutes)

---

## Step 5 — Write output files

For each diagram file, use this template:

```markdown
# C4 — Layer N: <Title>

> Generated by `/c4-model` skill on <ISO date>.
> Source: AST extracted from `apps/dashboard` and `apps/api`.
> Refresh: run `/c4-model` in Claude Code.

## Diagram

```mermaid
<diagram content>
` ``

## Notes

- <any warnings from AST extraction>
- <depth adjustments made>
- <anything notable about the architecture>
```

---

## Step 6 — Validate and report

After writing all files, confirm:
1. All `docs/c4/*.md` files exist and contain valid Mermaid fences
2. No alias in the Mermaid diagrams contains characters outside `[A-Za-z0-9_]`
3. Report a summary like:

```
✓ docs/c4/context.md           (Layer 1 — N nodes)
✓ docs/c4/containers.md        (Layer 2 — N nodes)
✓ docs/c4/components-dashboard.md  (Layer 3 — N components, N relationships)
✓ docs/c4/components-api.md    (Layer 3 — N components, N relationships)
✓ docs/c4/database.md          (N tables)   OR  ⚠ Skipped (Supabase not running)
```

---

## Regeneration

To regenerate specific layers without re-running AST extraction (if `ast-output.json` exists):
- Read `docs/c4/ast-output.json` directly
- Skip Steps 1–2
- Proceed from Step 4 for the requested layer(s)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ts-morph` not found | Run `pnpm install` in `.claude/skills/c4-model/` |
| 0 components extracted | Confirm `apps/dashboard/src` exists; check tsconfig paths |
| Mermaid render error | Check alias sanitisation; Mermaid C4 is strict about syntax |
| DB container not found | Run `supabase start` or skip DB step |
| Large component warnings | Increase `componentDepth` in `extract.ts` for that app |
