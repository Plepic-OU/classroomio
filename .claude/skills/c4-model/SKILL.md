# C4 Model — ClassroomIO

Generate or update the C4 architecture diagrams in `docs/c4/`. Diagrams already exist; this skill regenerates them when the codebase changes.

## What is AST?

An **Abstract Syntax Tree (AST)** is a tree-shaped data structure that represents source code structure without whitespace, comments, or syntactic sugar. Every construct — an `import` statement, a function definition, a variable declaration — becomes a node, with child nodes representing its sub-constructs.

**Why does this skill use it?** Rather than hardcoding component names, `extract.ts` runs `ts-morph` (a TypeScript compiler API wrapper) over every `.ts`/`.js` file in `apps/api/src/` and `apps/dashboard/src/`. For each file it reads the import declarations and resolves each module specifier to either another source file (internal dependency) or an npm package name (external). Files are grouped by directory path up to a configurable depth — e.g., `utils/redis/redis.ts` at depth=2 becomes component key `utils/redis`. The resulting directed graph of directory→directory imports is the input for the Layer 3 diagrams.

**Why not parse `.svelte` files?** ts-morph understands TypeScript and JavaScript. Svelte files have a custom syntax (`<script>`, template, `<style>`) the TypeScript compiler cannot parse. The extractor counts `.svelte` files per directory as metadata (`svelteCount`) and derives relationships only from co-located `.ts`/`.js` files.

---

## Tech Stack Reference

Used in diagram footnote labels as `(N)`. Each technology appears with its assigned number in the `techn` field of the relevant Container or Component node.

| # | Technology | Description |
|---|-----------|-------------|
| 1 | **SvelteKit 1.x** | Full-stack Svelte framework with file-based routing, server-side rendering, server actions, and API endpoints. The Dashboard uses the Node.js adapter for deployment. |
| 2 | **Svelte 4** | Reactive UI component compiler that outputs vanilla JavaScript with zero runtime overhead. Components use `$:` reactive declarations compiled away entirely at build time. |
| 3 | **Hono 4** | Lightweight, edge-first HTTP framework for Node.js and Cloudflare Workers with a typed middleware chain, Zod validation helpers, and built-in OpenAPI support. |
| 4 | **Node.js** | JavaScript runtime (v20) hosting the Hono API server as a long-running process on port 3002. Handles tasks too slow or stateful for SvelteKit server routes. |
| 5 | **Supabase** | Open-source Firebase alternative providing managed PostgreSQL, Auth, Realtime subscriptions, and Storage in one platform. Both apps use `@supabase/supabase-js`. |
| 6 | **PostgreSQL** | Open-source relational database backing all persistent data. Row-Level Security (RLS) policies enforce multi-tenant isolation per organisation at the database layer. |
| 7 | **Supabase Auth** | JWT-based authentication supporting email/password, magic links, and OAuth. The API validates tokens in `middlewares/auth.ts`; the Dashboard manages sessions via the JS client. |
| 8 | **Supabase Realtime** | WebSocket broadcast layer built on PostgreSQL logical replication. The Dashboard subscribes to row changes for live activity feeds and notifications. |
| 9 | **TypeScript** | Statically typed superset of JavaScript used across the entire monorepo. The Dashboard imports `@cio/api/rpc-types` for compile-time type safety on all API calls. |
| 10 | **Zod** | TypeScript-first schema validation library used in the API for env var parsing and request body validation. Schemas serve as runtime guards and TypeScript type generators simultaneously. |
| 11 | **Redis (ioredis)** | In-memory key-value store used by the API for sliding-window rate limiting and response caching. `utils/redis` centralises key patterns and exposes a Hono middleware factory. |
| 12 | **AWS S3 / Cloudflare R2** | Object storage for course media, lesson attachments, and generated PDF certificates. The API pre-signs URLs via `@aws-sdk/client-s3`; R2 is the preferred production backend. |
| 13 | **OpenAI GPT-4** | Completions API for AI-powered exercise grading, custom prompts, and exercise generation. All calls originate from SvelteKit server routes — never the browser. |
| 14 | **PostHog** | Product analytics SDK (`posthog-js`) for event tracking, session recording, and feature flags. Captures user flows without PII. |
| 15 | **Sentry** | Error monitoring and performance tracing in both the Dashboard (browser SDK) and API (`@sentry/node`). Sends stack traces and breadcrumbs to Sentry cloud. |
| 16 | **Nodemailer / ZeptoMail** | Dual-strategy email — Nodemailer is the local dev fallback, ZeptoMail (`zeptomail`) is the production provider. The API mail service selects the transport via env var. |
| 17 | **Carbon Design System** | IBM open-source design system providing Svelte components (`carbon-components-svelte`) and data charts (`@carbon/charts-svelte`) used in org/analytics views. |
| 18 | **Tailwind CSS** | Utility-first CSS framework for all Dashboard styling. Configured with `@tailwindcss/forms` and `@tailwindcss/typography` plugins. |
| 19 | **Polar** | Open-source billing platform for course subscriptions. The Dashboard integrates via `@polar-sh/sveltekit` for checkout, webhooks, and the customer portal. |
| 20 | **KaTeX** | Fast server-side LaTeX math renderer. The API's `routes/course/katex.ts` endpoint converts LaTeX strings to HTML for lesson content display. |
| 21 | **pnpm** | Fast, workspace-aware package manager using a content-addressable store and symlinked `node_modules`. Links local packages (`@cio/api`, `shared`) across the monorepo. |
| 22 | **Turborepo** | Build orchestrator that caches and parallelises workspace tasks. The Dashboard build depends on the API build to ensure `rpc-types.ts` is compiled first. |

---

## How to Regenerate Diagrams

Run whenever source code structure changes (new routes, new services, refactored directories).

### 1. Re-run AST extraction

```bash
# From monorepo root — use apps/api tsx to avoid ESM resolution issues with tsx v4
apps/api/node_modules/.bin/tsx .claude/skills/c4-model/extract.ts
```

This overwrites `docs/c4/ast-api.json` and `docs/c4/ast-dashboard.json` (both gitignored).

### 2. Read the new JSON

```bash
cat docs/c4/ast-api.json
cat docs/c4/ast-dashboard.json
```

### 3. Update the Layer 3 diagrams

**`docs/c4/layer3-api.md`** — One `Component(...)` per entry in `ast-api.json`. Rules:
- Alias = `c_` + key with `/` replaced by `_` (e.g., `routes/course` → `c_routes_course`)
- `label` = the component key
- `techn` = top external packages mapped to tech names with footnote numbers
- `descr` = one-sentence purpose inferred from key + file list
- `Rel(from, to, "verb")` for every entry in `imports[]`
- Wrap in `Container_Boundary(api_boundary, "API — @cio/api · Hono(3) · Node.js(4)")`

**`docs/c4/layer3-dashboard.md`** — Aggregate depth-3 JSON to depth-2 groups (9 groups). Rules:
- Merge `lib/components/*` → one `c_lib_components` node
- Merge `lib/utils/*` → one `c_lib_utils` node (but keep its sub-group descriptions in `descr`)
- Show `routes/lms`, `routes/org`, `routes/courses`, `routes/api`, `routes/course`, `routes (auth)` as separate nodes
- External nodes: `ext_supabase`, `ext_api`, `ext_openai`, `ext_polar`
- Skip `lib/mocks` (mock code samples, not architectural)
- Skip tiny auth routes (1-file each) — fold into `routes (auth)`

### 4. Update Layer 1 and Layer 2 if needed

`docs/c4/layer1-context.md` and `docs/c4/layer2-containers.md` change only when:
- New external systems are integrated
- New containers are added to the monorepo

Update them manually when those conditions are met.

### 5. Extract database schema (optional — requires `supabase start`)

```bash
DB=$(docker ps --filter "name=supabase_db" --format "{{.Names}}" | head -1)

# Tables and columns
docker exec "$DB" psql -U postgres -d postgres -t -A -F'|' -c "
SELECT c.table_name, c.column_name, c.data_type, c.is_nullable
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position;"

# Foreign keys
docker exec "$DB" psql -U postgres -d postgres -t -A -F'|' -c "
SELECT kcu.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_col
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY kcu.table_name, kcu.column_name;"
```

Write results to `docs/c4/database.md` as a compact Markdown table:
```
| Table | Column | Type | Nullable | FK |
|-------|--------|------|----------|----|
| courses | id | uuid | NO | |
| courses | org_id | uuid | NO | → organisations.id |
```

---

## Output Files

| File | Layer | Notes |
|------|-------|-------|
| `docs/c4/layer1-context.md` | 1 | System Context — update manually when external systems change |
| `docs/c4/layer2-containers.md` | 2 | Containers — update manually when new containers are added |
| `docs/c4/layer3-api.md` | 3 | API components — regenerate from `ast-api.json` after code changes |
| `docs/c4/layer3-dashboard.md` | 3 | Dashboard components — regenerate from `ast-dashboard.json` after code changes |
| `docs/c4/database.md` | — | DB schema — regenerate with running local Supabase |
| `docs/c4/ast-api.json` | — | Gitignored — AST extraction output |
| `docs/c4/ast-dashboard.json` | — | Gitignored — AST extraction output |
