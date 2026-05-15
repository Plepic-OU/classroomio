---
name: c4-model
description: >
  Generate or update C4 architecture diagrams (Layers 1–3) for ClassroomIO.
  Use this skill when the user asks to: generate C4 diagrams, update architecture docs,
  create component diagrams, visualize the system architecture, document containers or
  components, show how the dashboard/api/supabase fit together, update docs/c4/,
  regenerate architecture after code changes, or extract the database schema.
  Produces Mermaid C4 diagrams in docs/c4/ for L1 system context, L2 containers,
  L3 dashboard/api components (AST-derived), and optionally a database schema table.
---

# C4 Model Generator — ClassroomIO

Generates or updates C4 architecture diagrams for the ClassroomIO LMS monorepo.

## Output files

| File | Layer | Method |
|------|-------|--------|
| `docs/c4/system-context.md` | L1 System Context | Static (known arch) |
| `docs/c4/containers.md` | L2 Containers | Static (known arch) |
| `docs/c4/dashboard-components.md` | L3 Components | AST-extracted |
| `docs/c4/api-components.md` | L3 Components | AST-extracted |
| `docs/c4/database.md` | DB Schema | Supabase introspection |

Intermediate JSON at `docs/c4/extracted-{app}.json` is gitignored (debugging only).

## Steps

### 1. Install ts-morph (if not already installed)

```bash
grep -q '"ts-morph"' /workspaces/classroomio/package.json || \
  pnpm add -Dw ts-morph
```

### 2. Generate Layers 1–3

```bash
npx tsx .claude/skills/c4-model/scripts/generate-c4.ts
```

This script:
- Reads each app's `tsconfig.json` (following `extends` chains) to discover path aliases
- Walks `apps/dashboard/src` and `apps/api/src`, grouping files into components by directory depth
  (dashboard depth=4, api depth=2 — configurable at top of script)
- Parses `.ts`/`.js` imports with ts-morph; counts `.svelte` files as metadata only
- Warns if any component contains >50 files (depth too shallow)
- Emits deterministic Mermaid C4 diagrams to `docs/c4/`

### 3. Extract database schema (optional — requires `supabase start`)

```bash
npx tsx .claude/skills/c4-model/scripts/extract-database.ts
```

Uses `docker exec` against the local Supabase postgres container to query
`information_schema` for tables, columns, PKs, and FK references.

### 4. Read and present output

The four layer files (`system-context.md`, `containers.md`, `dashboard-components.md`,
`api-components.md`) are auto-loaded into context via `@../` entries in `CLAUDE.md` —
**do not re-read them**; just present their freshly-generated content.

`database.md` is intentionally excluded from auto-load (it is large). If the user asked
for the database schema, read `docs/c4/database.md` explicitly before presenting it.

If any `[WARN]` lines appeared in the script output, report them.

## Adjusting component depth

Edit `APPS` at the top of `generate-c4.ts`:
```typescript
{ name: 'dashboard', depth: 4, ... }  // increase for finer components
{ name: 'api',       depth: 2, ... }  // increase for finer components
```

Rule of thumb: if the diagram has components with >50 files, increase depth.
If every file is its own component, decrease depth.

## References

- `references/c4-conventions.md` — component granularity and relationship extraction details
- `references/mermaid-c4-syntax.md` — full Mermaid C4 syntax reference
