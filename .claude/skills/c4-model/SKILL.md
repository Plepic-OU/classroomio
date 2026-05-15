# Skill: C4 Model Generator

Generate or update C4 architecture diagrams (Layers 1–3) for ClassroomIO.
Outputs Mermaid C4 diagrams to `docs/c4/`.

---

## What this skill produces

| File | Contents |
|------|----------|
| `docs/c4/c4-context.md` | Layer 1 — System Context (people, external systems) |
| `docs/c4/c4-container.md` | Layer 2 — Containers (Dashboard, API, Landing, Course App) |
| `docs/c4/c4-component-api.md` | Layer 3 — API components derived from AST |
| `docs/c4/c4-component-dashboard.md` | Layer 3 — Dashboard components derived from AST |
| `docs/c4/database.md` | Database schema (tables, columns, foreign keys) |
| `docs/c4/extracted-*.json` | Intermediate JSON (gitignored) |

---

## Step-by-step execution

### Step 1 — Install skill dependencies

```bash
cd .claude/skills/c4-model && npm install
```

This installs `ts-morph` (AST parser) into `.claude/skills/c4-model/node_modules/`.

### Step 2 — Extract AST structure

```bash
cd .claude/skills/c4-model && node extract.mjs
```

Produces `docs/c4/extracted-api.json` and `docs/c4/extracted-dashboard.json`.

**What the extractor does:**
- Reads `apps/api/tsconfig.json` and `apps/dashboard/tsconfig.json` for path aliases (`$src/*`, `$lib/*`, `$mail/*`)
- Uses ts-morph to parse all `.ts`/`.js` files; counts `.svelte` files separately
- Groups files into *components* by first N directory segments (API: depth 2, Dashboard: depth 3)
- Strips SvelteKit dynamic route segments (`[slug]`, `[id]`) from Dashboard keys
- Resolves import paths through aliases and relative paths; maps cross-component imports as relationships
- Tracks external package usage per component (Supabase, Redis, S3, email, etc.)
- Warns if any component has >50 files (means depth is too shallow)

**To change component granularity**, edit `APP_CONFIGS` in `extract.mjs`:
```js
// In APP_CONFIGS at the top of extract.mjs:
dashboard: {
  depth: 4,          // increase from 3 to get finer granularity
  stripDynamic: true,
  excludeDirs: ['__mocks__', 'lib/mocks'],  // dirs to omit entirely
  mergeRules: [
    { prefix: 'lib/components/', into: 'lib/components' },
    { prefix: 'routes/api/', into: 'routes/api' },
    // add or remove rules to collapse/expand subtrees
  ],
}
```

**Default dashboard config** (docs/c4/extracted-dashboard.json): depth=3, 40 components, 61 relationships. Excludes `__mocks__` and `lib/mocks` (test fixtures). Merges `lib/components/*`, `routes/api/*`, `routes/lms/*`, `routes/invite*`.

**To run a single app:**
```bash
node extract.mjs --app api
node extract.mjs --app dashboard
```

### Step 3 — Generate Mermaid diagrams

```bash
cd .claude/skills/c4-model && node generate.mjs
```

Reads the JSON files and writes all four diagram files plus a component summary table.

Layer 1 and Layer 2 diagrams contain structural knowledge about ClassroomIO that is stable across runs.
Layer 3 diagrams are fully derived from the extracted JSON — every component and relationship comes from the AST.

### Step 4 (optional) — Extract database schema

Requires the local Supabase instance to be running (`supabase start`).

```bash
cd .claude/skills/c4-model && bash db-schema.sh
```

Produces `docs/c4/database.md` with all tables, columns (with NOT NULL markers), and foreign key relationships.

---

## Full run (all steps)

```bash
cd .claude/skills/c4-model
npm install
node extract.mjs
node generate.mjs
bash db-schema.sh   # optional — needs supabase start
```

---

## Reference material

- `references/c4-conventions.md` — C4 abstraction levels and ClassroomIO-specific mapping
- `references/mermaid-c4-syntax.md` — Complete Mermaid C4 syntax with examples

---

## Architecture notes for diagram generation

**API container** (`apps/api`) — Hono framework on Node.js:
- Components: config, constants, middlewares, routes/course, routes/mail, services/course, types, utils, utils/auth, utils/openapi, utils/redis
- External systems: Supabase (service-role), Cloudflare R2 (S3 SDK), ZeptoMail/SMTP, Redis

**Dashboard container** (`apps/dashboard`) — SvelteKit:
- Components: lib/utils/services (Supabase data fetching), lib/utils/store (Svelte stores), lib/components/* (UI by domain), routes/api/* (server endpoints), routes/org, routes/courses, routes/lms
- External systems: Supabase (anon key + JWT auth), OpenAI (server routes), Polar (billing webhooks), Sentry

**Key relationships:**
- Dashboard calls API for: PDF download, certificate generation, file presigning, KaTeX rendering, email sending
- Dashboard accesses Supabase directly for: auth, CRUD operations (bypasses API for most data)
- API uses Supabase service-role for: course cloning, lesson download, mail history

**Path aliases:**
- `$src/*` → `apps/api/src/*`
- `$lib/*` → `apps/dashboard/src/lib/*`
- `$mail/*` → `apps/dashboard/src/mail/*`
- `$app/*`, `$env/*` — SvelteKit virtual modules (ignored by extractor)

---

## Updating an existing diagram

To update after code changes:
1. Re-run `node extract.mjs` to refresh JSON
2. Re-run `node generate.mjs` to regenerate diagrams
3. For database changes: re-run `bash db-schema.sh`

Layer 1 and Layer 2 diagrams are stable — only update `generate.mjs` if the overall architecture changes (new container, new external service).

Layer 3 diagrams auto-update when source code structure changes.
