---
name: c4-model
description: Use this skill to generate or update C4 architecture diagrams (Layer 1 System Context, Layer 2 Container, Layer 3 Component) for the ClassroomIO codebase. Outputs Mermaid C4 diagrams under docs/c4/. The skill runs an AST-based extraction over apps/dashboard and apps/api using ts-morph to derive components from the directory structure and import graph, and a Postgres introspection step against the running local Supabase Docker container to produce a token-efficient schema overview. Invoke when the user asks to regenerate the C4 model, refresh the architecture docs, update component dependencies, or document the database schema for AI context.
---

# C4 model for ClassroomIO

This skill produces C4 model documentation for the monorepo. The Layer 3 component decompositions for `apps/dashboard` and `apps/api` are derived deterministically from the codebase — never hand-edit them; rerun the extraction.

## Output layout

```
docs/c4/
├── context.md                # Layer 1: System Context
├── containers.md             # Layer 2: Containers
├── components-dashboard.md   # Layer 3: Dashboard components
├── components-api.md         # Layer 3: API components
├── database.md               # Supabase schema overview
└── extraction.json           # raw extraction output (git-ignored)
```

## Workflow

Run these steps in order. Each step is idempotent.

### 1. Install skill dependencies (first run only)

The skill is self-contained — its `package.json` declares `ts-morph` and `tsx`.

```bash
pnpm install --dir .claude/skills/c4-model --ignore-workspace
```

`--ignore-workspace` keeps these deps out of the pnpm workspace lockfile.

### 2. Extract components from source

```bash
pnpm --dir .claude/skills/c4-model exec tsx scripts/extract-components.ts
```

Writes `docs/c4/extraction.json`. Reads `.claude/skills/c4-model/config.json` for per-app depth.

The script:
- Walks each app's source root for `.ts`, `.js`, `.svelte` files.
- Groups files into components by truncating each file's directory path to the configured depth.
- Parses `.ts`/`.js` with ts-morph and extracts `import`/`export from` declarations.
- For `.svelte` files, extracts imports via a regex over `<script>` blocks (ts-morph cannot parse Svelte).
- Resolves path aliases by reading each app's `tsconfig.json` (following the `extends` chain).
- Classifies each import as **internal** (same-app, used to build relationships between components), **cross-app** (a `@cio/*` workspace package — surfaces in the container diagram), or **external** (npm or SvelteKit virtual modules; recorded but not drawn in Layer 3).
- Validates: if any component contains more than 50 files, prints a warning. Increase depth in `config.json` and rerun.

If a component is too large, prefer increasing depth for that app over manual edits.

### 3. Extract database schema

Requires `supabase start` to be running.

```bash
bash .claude/skills/c4-model/scripts/extract-database.sh > docs/c4/database.md
```

The script `docker exec`s into the local Supabase Postgres container and queries `information_schema` and `pg_catalog`. Output is a compact Markdown table per schema — column name, type, nullability, and inline FK arrows. Not full DDL: enough for AI context but small.

### 4. Generate or update diagrams

Read `docs/c4/extraction.json` and `docs/c4/database.md`, then write Mermaid C4 diagrams under `docs/c4/`. Use the conventions in `references/c4-conventions.md` and the syntax cheatsheet in `references/mermaid-c4-syntax.md`.

When regenerating an existing diagram:
- Preserve any human-curated component **descriptions** that wouldn't be obvious from the file path. The extraction does not produce these; you write them.
- Replace the **component list** and **relationships** wholesale from the new extraction — those are derived data.
- Keep the diagram tight: a Layer 3 diagram should fit on one screen and convey intent, not enumerate every file.

Relationships in `extraction.json` carry an edge weight (`count` of import sites). Use this to prioritize which relationships to draw — drop edges with `count: 1` if the diagram becomes too dense, unless they are architecturally significant (e.g., cross-app).

## Configuration

`.claude/skills/c4-model/config.json` controls per-app extraction:

```json
{
  "apps": {
    "dashboard": {
      "srcRoot": "apps/dashboard/src",
      "tsconfig": "apps/dashboard/tsconfig.json",
      "depth": 3,
      "label": "Dashboard (SvelteKit LMS)"
    },
    "api": {
      "srcRoot": "apps/api/src",
      "tsconfig": "apps/api/tsconfig.json",
      "depth": 2,
      "label": "API (Hono service)"
    }
  },
  "externalPackagesOfInterest": ["@cio/api", "@cio/shared", "@supabase/supabase-js", "hono", "@sveltejs/kit", "svelte"]
}
```

- `depth` is the number of directory segments (counting from `srcRoot`) that form a component key. A file at `src/lib/components/Course/X.svelte` with `depth: 3` becomes part of component `lib/components/Course`; with `depth: 2` it folds into `lib/components`.
- Increase depth when the validator warns about a >50-file component; decrease it if the diagram has too many tiny components to be readable.

## References

- `references/c4-conventions.md` — naming, scope, and what each layer should and should not show.
- `references/mermaid-c4-syntax.md` — Mermaid C4 syntax cheatsheet with copy-pasteable templates.
