---
description: Generate or update C4 architecture diagrams (Layers 1–3) for ClassroomIO from live AST extraction. Outputs Mermaid C4 diagrams to docs/c4/. Optionally extracts the database schema from a running local Supabase instance.
---

You are generating C4 architecture diagrams (Layers 1–3) for the ClassroomIO monorepo.
Read the references at `.claude/skills/c4-model/references/` before proceeding — they contain
C4 conventions and Mermaid syntax rules you must follow.

Work from the repository root `/workspaces/ai-course-1` for all relative paths.

---

## STEP 1 — Install script dependencies (once)

Check whether ts-morph is already available:

```bash
ls .claude/skills/c4-model/scripts/node_modules/ts-morph 2>/dev/null && echo "ok" || echo "missing"
```

If missing, install:

```bash
cd .claude/skills/c4-model/scripts && npm install && cd -
```

---

## STEP 2 — Run AST extraction for both apps

Run both commands. Capture stderr to see warnings; stdout is redirected to the JSON files.

**Dashboard** (SvelteKit — depth 3 exposes feature-level directories under `lib/components/`,
`lib/utils/services/`, and `routes/`):

```bash
npx --prefix .claude/skills/c4-model/scripts tsx \
  .claude/skills/c4-model/scripts/extract-components.ts \
  --app apps/dashboard \
  --depth 3 \
  --name dashboard \
  --out docs/c4/_dashboard-components.json
```

**API** (Hono — depth 2 exposes `routes/course`, `routes/mail`, `services/course`,
`services/mail`, `utils/<feature>`):

```bash
npx --prefix .claude/skills/c4-model/scripts tsx \
  .claude/skills/c4-model/scripts/extract-components.ts \
  --app apps/api \
  --depth 2 \
  --name api \
  --out docs/c4/_api-components.json
```

Read both JSON files after extraction.

### Validation

- If any component in the JSON has `totalFileCount > 50` AND the total `components` array
  has fewer than 80 entries, increase `--depth` by 1 and re-run.
  If increasing depth produces more than 150 components total, revert to the original depth
  and accept the oversized component (it is a large feature area — document it as such in the diagram).
- If `components` array is empty, the src/ path was not found — check the app path.
- Ignore components whose key starts with `__mocks__`, `mocks/`, `mocks`, or `__tests__`.

**Dashboard guidance:** depth 3 is the recommended value. `lib/components/Course` will
appear as a large component (~90 files) — this is expected and correct (it's the core
feature area). Do not go to depth 4 as it produces an unmanageable number of components.

---

## STEP 3 — Generate Layer 1: System Context

File: `docs/c4/L1-system-context.md`

The ClassroomIO system boundary contains the Dashboard and API. External actors and systems:

- Persons: Teacher/Admin, Student
- External systems: Supabase (auth + PostgreSQL + object storage), AWS S3 (file uploads via
  presigned URLs), Email Provider (Nodemailer/ZeptoMail), Redis (rate limiting cache),
  Stripe/Polar (payments, from dashboard only), PostHog (analytics, from dashboard only),
  Sentry (error tracking, both apps)

Relationships derive from the CLAUDE.md architecture description and the codebase structure.

Output format — wrap the Mermaid block in a markdown heading:

```markdown
# L1 — System Context

> Generated: <ISO date>

\`\`\`mermaid
C4Context
  ...
\`\`\`
```

---

## STEP 4 — Generate Layer 2: Containers

File: `docs/c4/L2-containers.md`

Containers inside ClassroomIO:

| Container | Technology | Responsibility |
|-----------|-----------|----------------|
| Dashboard App | SvelteKit, TypeScript | Teacher + student UI, direct Supabase queries, SvelteKit API routes |
| API Server | Hono, Node.js | Long-running tasks: email, S3 presign, KaTeX, course clone |
| PostgreSQL | Supabase/Postgres | Primary data store — courses, orgs, users, submissions |
| Supabase Auth | Supabase GoTrue | JWT-based authentication |
| Supabase Storage | S3-compatible | User-uploaded files (images, attachments) |
| Redis | Redis | Rate limiting for the API server |

External containers reappear from L1: AWS S3, Email Provider, Stripe/Polar, PostHog, Sentry.

SvelteKit API routes (under `src/routes/api/`) run inside the Dashboard container —
they are NOT a separate container.

Output format — same markdown wrapper as L1.

---

## STEP 5 — Generate Layer 3: Dashboard Components

File: `docs/c4/L3-dashboard.md`

Use `docs/c4/_dashboard-components.json` as the source of truth.

### Filtering — produce a readable diagram, not an exhaustive inventory

The dashboard JSON will contain ~100 components at depth 3. Do NOT render all of them.
A C4 Layer 3 diagram should have 10–25 components per diagram for readability.

**Selection algorithm:**

1. Score each component: `score = (outgoing_rels * 2) + (incoming_rels * 3) + log2(totalFileCount + 1)`.
   Outgoing = count of `relationships[]` entries where `from == key`.
   Incoming = count of `relationships[]` entries where `to == key`.
2. Keep the top 12–20 components by score.
3. Always include: `routes/api`, `routes/lms`, `routes/org`,
   `lib/utils/services/api`, `lib/utils/functions`.
4. Filter out: `lib/mocks`, `lib/utils/types`, any key at depth <2 (e.g. bare `routes`).

### Mapping rules

1. Each selected component becomes a `Component(...)` element.
2. Split into **two sub-diagrams**:
   - `L3-dashboard-ui.md` — components whose key starts with `lib/components/` or `routes/`
   - `L3-dashboard-services.md` — components whose key starts with `lib/utils/`
   Within each sub-diagram, only include `Rel` lines where both endpoints are in that diagram;
   add a stub `Component_Ext` for cross-diagram references where needed.
3. Convert component keys to valid Mermaid aliases: replace `/` and `-` with `_`.
4. Derive a human-readable label from the last 1–2 path segments:
   - `lib/components/Course` → "Course Components"
   - `lib/utils/services/lms` → "LMS Service"
   - `routes/org` → "Org Admin Routes"
   - `routes/lms` → "LMS Routes"
5. Assign technology based on path segment pattern:
   - `routes/api/` → "SvelteKit API Handler"
   - `routes/` → "SvelteKit Routes"
   - `lib/components/` → "Svelte Components"
   - `lib/utils/services/` → "TypeScript Service"
   - `lib/utils/functions/` → "TypeScript Utility"
   - `lib/utils/store/` → "Svelte Store"
6. Description = brief one-liner of what the component does (derive from dir name context).
7. Also show as external references: Supabase (ContainerDb), API Server (Container).
8. Add `Rel` from service components to Supabase and API where applicable.

Output format — same markdown wrapper.

---

## STEP 6 — Generate Layer 3: API Components

File: `docs/c4/L3-api.md`

Use `docs/c4/_api-components.json`.

### Mapping rules (same as Step 5 with API-specific labels)

Technology labels for API:
- `routes/` → "Hono Route"
- `services/` → "TypeScript Service"
- `utils/` → "TypeScript Utility"
- `middlewares/` → "Hono Middleware"
- `config/` → "Configuration"
- `types/` → "TypeScript Types"

Also add as external references: Supabase (ContainerDb), AWS S3 (Container_Ext),
Email Provider (Container_Ext), Redis (Container_Ext), Dashboard App (Container).

Output format — same markdown wrapper.

---

## STEP 7 — Extract Database Schema (optional — requires `supabase start`)

File: `docs/c4/database.md`

Check if Supabase is running:

```bash
supabase status 2>/dev/null | grep -i "API URL" || echo "supabase_not_running"
```

If not running, write a placeholder to `docs/c4/database.md`:

```markdown
# Database Schema

> Schema extraction requires a running local Supabase instance.
> Run `supabase start` then re-run `/c4-model` to populate this file.
```

If Supabase IS running, find the postgres container and extract the schema:

```bash
# Find the postgres container name
docker ps --format '{{.Names}}' | grep -E 'supabase.*db|postgres' | head -1
```

Then run these queries (replace `<container>` with the actual container name):

```bash
# Tables with columns
docker exec <container> psql -U postgres -d postgres -t -A -F'|' -c "
SELECT t.table_name, c.column_name, c.data_type,
       c.is_nullable, c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c
  ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;"
```

```bash
# Foreign keys
docker exec <container> psql -U postgres -d postgres -t -A -F'|' -c "
SELECT tc.table_name, kcu.column_name,
       ccu.table_name AS ref_table, ccu.column_name AS ref_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.constraint_schema = ccu.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.constraint_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;"
```

Format output as compact Markdown — one `##` heading per table, a small column table,
then a `FK:` line listing outbound foreign keys. Example:

```markdown
## profiles

| column | type | nullable | default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| fullname | text | YES | |
| avatar_url | text | YES | |
| updated_at | timestamptz | YES | now() |

FK: id → auth.users.id
```

Do NOT include internal Supabase system tables (start with `_`, `pg_`, `auth.`, `storage.`
unless they are referenced by public FK targets).

---

## STEP 8 — Write index

File: `docs/c4/README.md`

```markdown
# ClassroomIO — C4 Architecture Diagrams

> Auto-generated by `/c4-model` skill on <ISO date>. Do not edit by hand.

| File | Contents |
|------|----------|
| [L1-system-context.md](L1-system-context.md) | Layer 1 — system context |
| [L2-containers.md](L2-containers.md) | Layer 2 — containers |
| [L3-dashboard.md](L3-dashboard.md) | Layer 3 — Dashboard app components |
| [L3-api.md](L3-api.md) | Layer 3 — API server components |
| [database.md](database.md) | Database schema reference |

## Regeneration

From the repo root:

\`\`\`bash
# First time only
cd .claude/skills/c4-model/scripts && npm install && cd -

# Generate / update diagrams
/c4-model
\`\`\`
```

---

## STEP 9 — Report to user

After writing all files, summarise:
- How many components and relationships were extracted per app
- Any depth warnings from extraction
- Whether database schema was extracted or skipped
- List of files written to `docs/c4/`
