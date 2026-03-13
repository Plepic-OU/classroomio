# C4 Architecture Skill

Generate or update C4 model diagrams (Layers 1–3) for ClassroomIO.

Outputs Mermaid C4 diagrams to `docs/c4/`. Layer 3 components are derived from AST, not hardcoded.

## When to use

User says things like "generate C4 diagrams", "update architecture docs", "run c4-model", "show me the architecture".

---

## Step 1 — Preflight Checks

Run these in parallel:

```bash
# Check Supabase DB is running (needed for database.md)
docker ps --format '{{.Names}}' | grep supabase_db_classroomio

# Check ts-morph is installed
pnpm ls -w ts-morph 2>/dev/null | grep ts-morph

# Ensure output dir exists
ls /workspaces/classroomio/docs/c4/ 2>/dev/null || mkdir -p /workspaces/classroomio/docs/c4/
```

If `ts-morph` is not installed:
```bash
pnpm add -Dw ts-morph
```

If Supabase is not running, warn the user that `database.md` will be skipped but continue with diagrams.

---

## Step 2 — Run Extraction

```bash
cd /workspaces/classroomio && npx tsx .claude/skills/c4-model/extract.ts
```

The script outputs `docs/c4/extracted.json` and prints component counts + any warnings.

**If any component warning fires** ("has N files — depth too shallow"), adjust `componentDepth` in `extract.ts` for that app and re-run before proceeding.

---

## Step 3 — Read Extraction Output

Read `docs/c4/extracted.json`. Note:
- `apps[].components` — list of `ComponentNode` objects (id, label, fullPath, app, tsFileCount, svelteFileCount)
- `apps[].internalRelationships` — cross-component imports within same app
- `apps[].externalRelationships` — imports of known external packages
- `apps[].warnings` — depth calibration issues

---

## Step 4 — Extract Database Schema (if Supabase running)

Run both queries:

```bash
# Tables and columns
docker exec supabase_db_classroomio psql -U postgres -t -c \
  "SELECT table_name, column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_schema='public'
   ORDER BY table_name, ordinal_position;"

# Foreign keys
docker exec supabase_db_classroomio psql -U postgres -t -c \
  "SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_col
   FROM information_schema.table_constraints tc
   JOIN information_schema.key_column_usage kcu
     ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
   JOIN information_schema.constraint_column_usage ccu
     ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
   ORDER BY tc.table_name, kcu.column_name;"
```

---

## Step 5 — Generate Diagrams

Read `references/c4-conventions.md` and `references/classroomio-external-systems.md` before writing any diagram.

### docs/c4/l1-system-context.md

Static diagram (no AST needed). Use the canonical external systems list. Format:

```markdown
# L1 System Context
_Generated: {ISO timestamp}_

\`\`\`mermaid
graph TD
  Educator["Educator\n(user)"]
  Student["Student\n(user)"]
  CIO["ClassroomIO\n(LMS platform)"]
  Supabase["Supabase\n(DB + Auth + Realtime)"]
  ...
  Educator -->|"creates courses"| CIO
  Student -->|"enrolls, submits"| CIO
  CIO -->|"stores data"| Supabase
  ...
\`\`\`

| System | Role |
|--------|------|
...
```

### docs/c4/l2-containers.md

Static diagram. Containers: Dashboard (SvelteKit/Vercel), API (Hono/Fly.io), Supabase, Redis, S3/R2, Edge Functions (Supabase). Include HTTP/fetch call from Dashboard to API.

### docs/c4/l3-dashboard.md

Use `extracted.json` components where `app === "dashboard"`.

Group components into logical swimlanes using `subgraph`:
- `subgraph Routes` — components whose `fullPath` starts with `routes/`
- `subgraph Components` — components starting with `lib/components/`
- `subgraph Utils` — components starting with `lib/utils/`
- `subgraph Mail` — components starting with `lib/mail` or `mail/`

Apply relationship label rules from `c4-conventions.md`.
When `svelteFileCount > 0`, include counts in node label: `["Course\n(4 ts, 12 svelte)"]`.

Add a `## Warnings` section at the bottom if `apps[0].warnings` is non-empty.

### docs/c4/l3-api.md

Use `extracted.json` components where `app === "api"`.

Group:
- `subgraph Routes` — `routes/`
- `subgraph Services` — `services/`
- `subgraph Utils` — `utils/`
- `subgraph Infrastructure` — `config/`, `constants/`, `middlewares/`, `types/`

### docs/c4/database.md

Format as token-efficient pipe tables grouped by domain. See `c4-conventions.md` for format.

Domain groupings:
- **Auth / Identity**: `profile`, `app_config`, related auth tables
- **Organization**: `organization`, `organizationmember`, `group`, `groupmember`, `invite`
- **Course**: `course`, `lesson`, `exercise`, `option`, `question`, `questionnaire`
- **Assessment**: `submission`, `grade`, `lesson_completion`, `course_completion`
- **Community**: `post`, `comment`, `reaction`, `poll`, `poll_vote`
- **Apps**: `apps`, `app_install`, anything billing/polar related

---

## Step 6 — Update .gitignore

Ensure `docs/c4/extracted.json` is in `.gitignore` (the extraction script does this automatically, but verify).

---

## Step 7 — Report to User

List all files written and their sizes. Note any warnings. Suggest next steps:
- "Run again after major refactors"
- "L3 diagrams may be dense — consider filtering by subgraph in your diagram renderer"
