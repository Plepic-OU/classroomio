---
name: c4-model
description: Generate or refresh C4 architecture diagrams (Layers 1-3) for ClassroomIO. Use when the user asks for an architecture diagram, C4 model, context/container/component diagram, or wants to refresh `docs/c4/`. Outputs Mermaid C4 diagrams driven by AST extraction of `apps/dashboard` and `apps/api`.
---

# c4-model — ClassroomIO C4 diagrams (L1–L3)

Generates **Mermaid C4 diagrams** in `docs/c4/`, with Layer 3 components derived from AST analysis (ts-morph) — never hardcoded.

## When to use

- "Create a C4 model / architecture diagram for this repo"
- "Update the C4 diagrams"
- "Generate a Layer 3 component diagram for the API / dashboard"
- "Refresh `docs/c4/`"

## Outputs

| File | Contents |
|---|---|
| `docs/c4/layer1-context.md` | System context (users + external systems around ClassroomIO) |
| `docs/c4/layer2-containers.md` | Containers (dashboard, api, marketing, docs, course-app, db, edge functions) |
| `docs/c4/layer3-api.md` | Components inside the **api** container, from AST |
| `docs/c4/layer3-dashboard.md` | Components inside the **dashboard** container, from AST |
| `docs/c4/database.md` | DB schema (from running Supabase) — token-efficient table list + FK refs |
| `docs/c4/components.json` | Raw AST extraction output (gitignored) |

L1 and L2 are stable architectural facts (described in `references/classroomio-context.md`). L3 is regenerated from code every run.

## Workflow

Run the steps in order. **Stop and ask** if a step fails — do not invent components.

### 1. Extract components from AST

```bash
node .claude/skills/c4-model/scripts/extract-components.mjs
```

The script:
- Auto-installs `ts-morph` into the skill directory if missing (no monorepo changes).
- Reads `apps/dashboard/tsconfig.json` and `apps/api/tsconfig.json`, parses `compilerOptions.paths` to build alias maps dynamically.
- Walks `.ts` / `.js` files with ts-morph; parses `<script>` blocks from `.svelte` files with a regex fallback.
- Groups files into components by directory at a configurable **depth per app** (defaults: dashboard=3, api=2).
- Records cross-component imports as relations with edge counts.
- **Validates depth**: if any component contains >50 files, the script exits non-zero and tells you to increase depth.

Output: `docs/c4/components.json` (gitignored).

Override depth if validation fails:
```bash
node .claude/skills/c4-model/scripts/extract-components.mjs --depth-dashboard=4 --depth-api=3
```

### 2. Extract database schema

Requires `supabase start` to be running.

```bash
node .claude/skills/c4-model/scripts/extract-db-schema.mjs
```

Queries `information_schema` + `pg_catalog` via `docker exec` on the Supabase Postgres container. Writes `docs/c4/database.md` as a compact table list with FK refs — not full DDL.

If Supabase isn't running, the script tells you and exits cleanly; don't fabricate schema.

### 3. Generate Mermaid C4 diagrams

Read:
- `docs/c4/components.json` (from step 1)
- `references/classroomio-context.md` (L1+L2 facts)
- `references/mermaid-c4.md` (syntax cheat sheet)
- `references/c4-layers.md` (granularity rules)

Then write the four Mermaid files under `docs/c4/`. Keep each diagram **concise** — this is for AI context, not a poster.

**If a diagram file already exists, update it in place** (overwrite via `Write`, or `Edit` the changed sections) — do not create a parallel `*-v2.md` or new file. The four filenames above are the canonical locations. The same applies to `database.md` and `components.json`.

Concretely:
- **L1**: 1 Person, 1 System (ClassroomIO), all external systems from `classroomio-context.md`. ~8–12 nodes.
- **L2**: `System_Boundary` around ClassroomIO with one `Container`/`ContainerDb` per app/service in `apps/`. External systems remain at the perimeter. ~10–14 nodes.
- **L3 (per container)**: `Container_Boundary` around the container, one `Component` per key in `components.json` for that app. Cross-component edges from the relations array — collapse edges with count <2 unless they're the only edge for that component.

Don't list every component as a separate `Component()` call if the file has >30 — group siblings under a meaningful parent and note the count. Readability beats completeness at this layer.

## Re-running

The script is idempotent. Re-run any time the AST changes. JSON output is gitignored; the four Markdown files are checked in and reviewed like docs.
